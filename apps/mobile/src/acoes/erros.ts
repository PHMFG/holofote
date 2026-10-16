import { router } from 'expo-router';
import { Alert } from 'react-native';
import { ErroDaApi } from '../api/cliente';

/** Falha de rede do fetch (sem resposta): no React Native vira TypeError ("Network request failed"). */
const ehErroDeRede = (erro: unknown) => erro instanceof TypeError;

/**
 * Trata o erro de uma ação do jogador: sem energia abre a folha 19; moderação e regras explicam
 * o motivo em uma frase (a mensagem já vem do servidor em pt-BR); falha de rede pede a internet;
 * qualquer outra coisa (resposta fora do contrato, ZodError) avisa que o resultado é incerto, já
 * que a ação pode ter sido feita no servidor.
 */
export function tratarErroDeAcao(erro: unknown) {
  if (erro instanceof ErroDaApi) {
    if (erro.codigo === 'sem_energia') {
      router.push('/sem-energia');
      return;
    }
    Alert.alert(
      erro.codigo === 'moderacao' ? 'Não dá para publicar isso' : 'Não deu certo',
      erro.message,
    );
    return;
  }
  if (ehErroDeRede(erro)) {
    Alert.alert('Sem conexão', 'Confira a internet e tente de novo.');
    return;
  }
  Alert.alert(
    'Resposta inesperada',
    'Recebemos uma resposta inesperada. Confira o registro antes de repetir.',
  );
}
