type RelayerEvent = {
    event: string;
    [key: string]: unknown;
};

declare global {
    interface Window {
        relayer: Record<string, unknown>[];
    }
}

export function pushEvent(data: RelayerEvent) {
    if (typeof window === 'undefined') return;
    window.relayer = window.relayer || [];
    window.relayer.push(data);

}

export const page = {
    page_path: window.location.pathname,
    page_title: document.title.slice(0, -" · Paolo Bietolini".length),
    page_search: document.location.search,
};