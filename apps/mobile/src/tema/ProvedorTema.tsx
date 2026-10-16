import { montarTema, type Modo, type Tema } from '@holofote/tokens';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useAparencia } from '../estado/aparencia';

const ContextoTema = createContext<Tema | null>(null);

export function ProvedorTema({ children }: { children: ReactNode }) {
  const preferencia = useAparencia((s) => s.tema);
  const destaque = useAparencia((s) => s.destaque);
  const esquema = useColorScheme();

  // Teclado, alertas e componentes nativos seguem a escolha do jogador.
  useEffect(() => {
    Appearance.setColorScheme(
      preferencia === 'sistema' ? 'unspecified' : preferencia === 'escuro' ? 'dark' : 'light',
    );
  }, [preferencia]);

  const modo: Modo =
    preferencia === 'sistema' ? (esquema === 'dark' ? 'escuro' : 'claro') : preferencia;
  const tema = useMemo(() => montarTema(modo, destaque), [modo, destaque]);

  const temaNavegacao = useMemo(() => {
    const base = modo === 'escuro' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: modo === 'escuro',
      colors: {
        ...base.colors,
        background: tema.cores.fundo,
        card: tema.cores.superficie,
        text: tema.cores.texto,
        border: tema.cores.linha,
        primary: tema.cores.destaqueTinta,
        notification: tema.cores.destaque,
      },
    };
  }, [modo, tema]);

  return (
    <ContextoTema.Provider value={tema}>
      <ThemeProvider value={temaNavegacao}>
        {children}
        <StatusBar style={modo === 'escuro' ? 'light' : 'dark'} />
      </ThemeProvider>
    </ContextoTema.Provider>
  );
}

export function useTema(): Tema {
  const tema = useContext(ContextoTema);
  if (!tema) throw new Error('useTema precisa estar dentro do ProvedorTema');
  return tema;
}
