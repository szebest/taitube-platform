declare module 'react-player/lib/utils' {
  export function getSDK(
    url: string,
    sdkGlobal: string,
    sdkReady?: string | null,
    isLoaded?: (sdk: unknown) => boolean,
    fetchScript?: (url: string, done: (error: Error | null) => void) => void
  ): Promise<unknown>;
}
