import { readInitialDaemonConnectionHint } from "@/runtime/host-runtime";
import { asyncStorageOnboardingCompletion } from "./completion-storage";
import {
  createOnboardingModel,
  type OnboardingModel,
  type OnboardingCompletionStorage,
} from "./model";

let instance: OnboardingModel | null = null;

// A page its daemon served (Kumo serves every computer's this way) was set up by whoever runs
// that daemon, so setup never opens by itself there; Settings can still reopen it.
const servedSetUp: OnboardingCompletionStorage = {
  ...asyncStorageOnboardingCompletion,
  isCompleted: async () => true,
};

/** The app's one setup model, created on first use so storage is read once per launch. */
export function getOnboardingModel(): OnboardingModel {
  instance ??= createOnboardingModel({
    storage:
      readInitialDaemonConnectionHint() === null ? asyncStorageOnboardingCompletion : servedSetUp,
  });
  return instance;
}
