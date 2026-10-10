export class MovieCatalogError extends Error { status: number }
export function authorizeMovieCatalog(request: Request, env: { FIREBASE_PROJECT_ID?: string; CHECKPOINT_BOARD_ID: string }): Promise<void>
export function movieCatalog(env: { TMDB_READ_ACCESS_TOKEN?: string }, params: Record<string,string>): Promise<unknown>
