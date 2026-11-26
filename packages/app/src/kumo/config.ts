/**
 * The Kumo deployment this app signs in to: its control plane, the zone its computers' ports are
 * served under, and the Clerk OAuth client registered for this app (kumo-computer
 * docs/control-plane-deploy-sop.md, "The phone app's Clerk client").
 *
 * ponytail: staging only. Add production here once its Clerk client exists.
 */
export const kumo = {
  api: "https://staging.kumo.computer",
  zone: "staging.mykumo.xyz",
  issuer: "https://rational-mantis-98.clerk.accounts.dev",
  clientId: "wGXEkkmxvV4vRI8S",
  redirectUri: "kumo-agent://oauth",
  /** The port Kumo's apps catalogue runs kumo-agent on. */
  port: 6868,
} as const;
