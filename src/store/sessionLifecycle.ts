export interface UserSessionSnapshot {
  token: string;
  userId: string;
  name: string;
  avatar: string;
  introduction: string;
  roles: string[];
  sessionGeneration: number;
}

export interface UserSessionResources {
  removeToken: () => void;
  resetRouter: () => void;
  clearPermissionRoutes: () => void;
  clearCachedViews: () => void;
}

export function clearUserSession(state: UserSessionSnapshot, resources: UserSessionResources): number {
  state.sessionGeneration++;
  state.token = '';
  state.userId = '';
  state.name = '';
  state.avatar = '';
  state.introduction = '';
  state.roles = [];
  resources.removeToken();
  resources.resetRouter();
  resources.clearPermissionRoutes();
  resources.clearCachedViews();
  return state.sessionGeneration;
}

export function isUserSessionCurrent(
  state: Pick<UserSessionSnapshot, 'token' | 'sessionGeneration'>,
  token: string,
  generation: number
): boolean {
  return state.token === token && state.sessionGeneration === generation;
}

export async function readUserInfoForSession<T>(options: {
  state: Pick<UserSessionSnapshot, 'token' | 'sessionGeneration'>;
  token: string;
  generation: number;
  read: () => Promise<unknown>;
  apply: (value: unknown) => T;
}): Promise<{ kind: 'stale' } | { kind: 'success'; value: T }> {
  const value = await options.read();
  if (!isUserSessionCurrent(options.state, options.token, options.generation)) return { kind: 'stale' };
  return { kind: 'success', value: options.apply(value) };
}
