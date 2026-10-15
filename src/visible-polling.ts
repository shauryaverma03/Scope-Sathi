type Visibility = {
  visibilityState: string;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
};
export function visiblePolling<T>(
  source: Visibility,
  work: () => Promise<T>,
  success: (result: T) => void,
  failure: (error: unknown) => void,
  schedule = (tick: () => void) => {
    const timer = setInterval(tick, 45000);
    return () => clearInterval(timer);
  },
) {
  let active = true,
    pending = false;
  const refresh = async () => {
    if (!active || pending || source.visibilityState !== "visible") return;
    pending = true;
    try {
      const result = await work();
      if (active) success(result);
    } catch (error) {
      if (active) failure(error);
    } finally {
      pending = false;
    }
  };
  const tick = () => {
    void refresh();
  };
  source.addEventListener("visibilitychange", tick);
  const cancel = schedule(tick);
  tick();
  return {
    refresh,
    stop: () => {
      active = false;
      cancel();
      source.removeEventListener("visibilitychange", tick);
    },
  };
}
