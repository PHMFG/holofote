// Corrige o `pod install` quando o caminho do projeto tem acentos (como "Programação").
// O CocoaPods lê a saída de comandos como binário (ASCII-8BIT) e o podspec do
// hermes-engine junta essa saída com caminhos UTF-8, o que dá
// "incompatible character encodings: BINARY (ASCII-8BIT) and UTF-8".
// O ajuste, injetado no topo do Podfile gerado, marca essa saída como UTF-8.
const { withPodfile } = require('expo/config-plugins');

const MARCA = '# holofote: saída de comandos do CocoaPods em UTF-8 (plugins/caminho-utf8.js)';

const AJUSTE = `${MARCA}
Pod::Executable.singleton_class.prepend(Module.new do
  def execute_command(*args)
    saida = super
    saida.is_a?(String) ? saida.dup.force_encoding(Encoding::UTF_8) : saida
  end
end)
`;

module.exports = function withCaminhoUtf8(config) {
  return withPodfile(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARCA)) {
      cfg.modResults.contents = `${AJUSTE}\n${cfg.modResults.contents}`;
    }
    return cfg;
  });
};
