import { type Query, useMutation } from "@tanstack/react-query";
import { LogIn, LogOut, Play } from "lucide-react-native";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { useFetchQuery } from "@/data/query";
import { queryClient } from "@/data/query-client";
import {
  getHostRuntimeStore,
  useHostRegistryLoaded,
  useHostRuntimeConnectionStatuses,
  useHosts,
} from "@/runtime/host-runtime";
import {
  computersQuery,
  KumoRefusedError,
  KumoSignedOutError,
  signIn,
  signOut,
  signedInQuery,
  startComputer,
} from "./api";
import { syncComputers } from "./sync";
import { type Computer, computersNeedingRows, kumoHostsByHandle } from "./plan";

const NO_COMPUTERS: readonly Computer[] = [];

/**
 * Kumo can't tell the phone when a computer starts, stops or is shared, so the list is polled
 * while the app is open: every few seconds while one is starting, half a minute otherwise.
 */
function refetchInterval(query: Query<Computer[]>): number {
  const starting = query.state.data?.some((computer) => computer.status === "provisioning");
  return starting ? 3_000 : 30_000;
}

function refreshKumo(): void {
  void queryClient.invalidateQueries({ queryKey: ["kumo"] });
}

/**
 * Keeps the host list in step with the person's Kumo computers: on sign-in, whenever the app
 * comes back to the foreground, and whenever a poll brings a change. Signed out, every Kumo
 * host goes.
 */
export function KumoSync() {
  const signedIn = useFetchQuery(signedInQuery).data;
  const registryLoaded = useHostRegistryLoaded();
  const computers = useFetchQuery({
    ...computersQuery,
    enabled: signedIn === true,
    refetchInterval,
  }).data;
  const target = signedIn === false ? NO_COMPUTERS : computers;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshKumo();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!registryLoaded || !target) return;
    void syncComputers(getHostRuntimeStore(), target);
  }, [registryLoaded, target]);

  return null;
}

function FailureText({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  // Signed out isn't a failure: the section turns into Sign in.
  if (!error || error instanceof KumoSignedOutError) return null;
  // Kumo writes its refusals for the person reading them; anything else gets ours.
  const sentence = error instanceof KumoRefusedError ? error.message : t("kumo.errors.generic");
  return <Text style={styles.error}>{sentence}</Text>;
}

// `ready` has a row only while its host fails to connect (`computersNeedingRows`).
const STATUS_LABEL = {
  provisioning: "kumo.status.starting",
  ready: "kumo.status.notRunning",
  stopped: "kumo.status.stopped",
  failed: "kumo.status.failed",
} as const satisfies Record<Computer["status"], string>;

function ComputerRow({ computer }: { computer: Computer }) {
  const { t } = useTranslation();
  const start = useMutation({
    mutationFn: () => startComputer(computer.id),
    onSuccess: refreshKumo,
  });
  const { mutate: mutateStart } = start;
  const handleStart = useCallback(() => mutateStart(), [mutateStart]);
  const canStart = computer.status === "stopped" || computer.status === "failed";

  return (
    <View testID={`kumo-computer-${computer.handle}`}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.handle} numberOfLines={1}>
            {computer.handle}
          </Text>
          <Text style={styles.status}>{t(STATUS_LABEL[computer.status])}</Text>
        </View>
        {canStart ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Play}
            loading={start.isPending}
            onPress={handleStart}
            testID={`kumo-computer-start-${computer.handle}`}
          >
            {t("kumo.start")}
          </Button>
        ) : null}
      </View>
      <FailureText error={start.error} />
    </View>
  );
}

function SignedIn() {
  const { t } = useTranslation();
  const hosts = useHosts();
  const computers = useFetchQuery(computersQuery);
  const leave = useMutation({ mutationFn: signOut });
  const { mutate: mutateSignOut } = leave;
  const handleSignOut = useCallback(() => mutateSignOut(), [mutateSignOut]);
  const serverIds = useMemo(() => [...kumoHostsByHandle(hosts).values()], [hosts]);
  const statuses = useHostRuntimeConnectionStatuses(serverIds);
  const rows = useMemo(
    () => computersNeedingRows(computers.data ?? NO_COMPUTERS, hosts, statuses),
    [computers.data, hosts, statuses],
  );

  return (
    <View style={styles.section} testID="kumo-section">
      <View style={styles.row}>
        <Text style={styles.title}>{t("kumo.title")}</Text>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={LogOut}
          loading={leave.isPending}
          onPress={handleSignOut}
          testID="kumo-sign-out"
        >
          {t("kumo.signOut")}
        </Button>
      </View>
      {rows.map((computer) => (
        <ComputerRow key={computer.id} computer={computer} />
      ))}
      <FailureText error={computers.error ?? leave.error} />
    </View>
  );
}

function SignedOut() {
  const { t } = useTranslation();
  const enter = useMutation({ mutationFn: signIn });
  const { mutate: mutateSignIn } = enter;
  const handleSignIn = useCallback(() => mutateSignIn(), [mutateSignIn]);

  return (
    <View style={styles.section}>
      <Button
        variant="default"
        leftIcon={LogIn}
        loading={enter.isPending}
        onPress={handleSignIn}
        testID="kumo-sign-in"
      >
        {t("kumo.signIn")}
      </Button>
      <FailureText error={enter.error} />
    </View>
  );
}

/** Sign in to Kumo, or the person's computers that aren't hosts yet, with Start for stopped ones. */
export function KumoSection() {
  const signedIn = useFetchQuery(signedInQuery).data;
  if (signedIn === undefined) return null;
  return signedIn ? <SignedIn /> : <SignedOut />;
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  rowText: {
    flexShrink: 1,
  },
  title: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  handle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  status: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  error: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.sm,
  },
}));
