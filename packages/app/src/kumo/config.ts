/**
 * The Kumo deployment this app signs in to: its control plane, the zone its computers' ports are
 * served under, and the Clerk OAuth client registered for this app (kumo-computer
 * docs/control-plane-deploy-sop.md, "The phone app's Clerk client").
 *
 * ponytail: production only. A build that should sign in to staging edits these four lines
 * (staging: staging.kumo.computer, staging.mykumo.xyz, rational-mantis-98.clerk.accounts.dev,
 * wGXEkkmxvV4vRI8S); a build-time switch when someone needs both.
 */
export const kumo = {
  api: "https://kumo.computer",
  zone: "mykumo.xyz",
  issuer: "https://clerk.kumo.computer",
  clientId: "VWdIHyJpYlKSrD2M",
  redirectUri: "kumo-agent://oauth",
  /** The port Kumo's apps catalogue runs kumo-agent on. */
  port: 6868,
} as const;
