// O simulador alcança o servidor da máquina em 127.0.0.1. Para aparelho físico na rede local,
// defina EXPO_PUBLIC_API_URL (ex.: http://192.168.0.10:3333) e HOST=0.0.0.0 no servidor.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3333';

export const WS_URL = API_URL.replace(/^http/, 'ws');
