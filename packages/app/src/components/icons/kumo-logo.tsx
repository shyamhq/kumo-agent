import Svg, { Path } from "react-native-svg";
import { withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";

interface KumoLogoProps {
  size?: number;
  color?: string;
}

// Kumo's mark, a cloud with a prompt in it, in one colour: the prompt is a hole (evenodd), so it
// also works as the splash shimmer's mask. Traced from Kumo's app icon.
const MARK =
  "M372 748 A173 173 0 0 1 199.3 584.8 A222 222 0 0 1 607.9 412.1 A178 178 0 1 1 690 748 Z M369.9 459.2 L469.9 538.2 A24 24 0 0 1 470.3 575.5 L370.3 658.5 A24 24 0 0 1 339.7 621.5 L416.9 557.5 L340.1 496.8 A24 24 0 0 1 369.9 459.2 Z M517 614 H630 A23 23 0 0 1 630 660 H517 A23 23 0 0 1 517 614Z";

const ThemedPath = withUnistyles(Path);
const foregroundFill = (theme: Theme) => ({ fill: theme.colors.foreground });

export function KumoLogo({ size = 64, color }: KumoLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="140 138 744 744" fill="none">
      {color ? (
        <Path d={MARK} fill={color} fillRule="evenodd" />
      ) : (
        <ThemedPath d={MARK} fillRule="evenodd" uniProps={foregroundFill} />
      )}
    </Svg>
  );
}
