// Every URL in the app, in one place, so pages never hand-build paths.
export const ROUTES = {
  login: "/login",
  home: "/",
  lend: "/lend",
  trips: "/trips",
  trip: (id: string) => `/trips/${id}`,
  returnTrip: (id: string) => `/trips/${id}/return`,
  fuel: "/fuel",
  settings: "/settings",
  share: (token: string) => `/share/${token}`,
};
