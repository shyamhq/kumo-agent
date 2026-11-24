export const ALL_HOSTS_OPTION_ID = "__all_hosts__";
export const ENABLE_BUILT_IN_DAEMON_OPTION_ID = "__enable_built_in_daemon__";

export function getHostPickerLabel(
  hosts: Array<{ label: string; serverId: string }>,
  value: string,
  config?: { includeAllHost?: boolean },
): string {
  if (config?.includeAllHost && value === ALL_HOSTS_OPTION_ID) {
    return "All hosts";
  }
  return (
    hosts.find((host) => host.serverId === value)?.label ??
    (config?.includeAllHost ? "All hosts" : "Host")
  );
}
