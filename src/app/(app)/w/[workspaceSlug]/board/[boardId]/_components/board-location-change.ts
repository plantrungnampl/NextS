export const LOCATION_CHANGE_EVENT = "nexts:location-change";

export function dispatchLocationChangeEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
}

export function subscribeToLocationChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
  };
}

export function getLocationSearchSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}
