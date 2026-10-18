// Gera o ícone e a imagem da splash do Holofote com CoreGraphics (nada a instalar).
//
//   cd apps/mobile/assets/fonte && swift gerar-icone.swift
//
// Saídas (em apps/mobile/assets):
//   icon.png              1024 x 1024, RGB sem transparência e sem cantos arredondados (a Apple arredonda)
//   splash-icon.png       1024 x 1024 com transparência: a esfera sozinha, para a splash clara e escura
//
// Os valores vêm de packages/tokens (src/gerado.ts): gradiente "esferaPreta" do modo claro,
// destaque "laranja" e as superfícies do modo escuro. Se os tokens mudarem, atualize as constantes.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// ---------- Tokens ----------

func cor(_ hex: UInt32, _ alfa: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: alfa)
}

let espaco = CGColorSpace(name: CGColorSpace.sRGB)!

// gradientes.claro.esferaPreta: radial, centro (0.35, 0.30), raio 0.625 do lado.
let esferaPreta: [UInt32] = [0x5c6060, 0x1f2121, 0x060707]
let esferaPosicoes: [CGFloat] = [0, 0.45, 1]
let esferaCentro = CGPoint(x: 0.35, y: 0.30)
let esferaRaio: CGFloat = 0.625

// destaques.laranja
let laranja: UInt32 = 0xff5a1f
let laranjaClaro: UInt32 = 0xff8a5c  // tintaEscuro
let laranjaForte: UInt32 = 0xf03f00  // graficoClaro

// neutros.escuro: superficie e superficie2 (fundo do ícone)
let fundoTopo: UInt32 = 0x1b1c1e
let fundoBase: UInt32 = 0x0b0c0d

// ---------- Desenho ----------

func gradiente(_ cores: [CGColor], _ posicoes: [CGFloat]) -> CGGradient {
    CGGradient(colorsSpace: espaco, colors: cores as CFArray, locations: posicoes)!
}

/// Contexto com origem no canto superior esquerdo (y para baixo), como no Figma.
func novoContexto(lado: Int, opaco: Bool) -> CGContext {
    let info = opaco ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
    let ctx = CGContext(
        data: nil, width: lado, height: lado, bitsPerComponent: 8, bytesPerRow: 0,
        space: espaco, bitmapInfo: info)!
    ctx.translateBy(x: 0, y: CGFloat(lado))
    ctx.scaleBy(x: 1, y: -1)
    ctx.interpolationQuality = .high
    ctx.setAllowsAntialiasing(true)
    return ctx
}

func salvar(_ ctx: CGContext, em caminho: String) {
    let imagem = ctx.makeImage()!
    let destino = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: caminho) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destino, imagem, nil)
    guard CGImageDestinationFinalize(destino) else { fatalError("não salvou \(caminho)") }
    print("gerado \(caminho)")
}

func radial(_ ctx: CGContext, _ g: CGGradient, centro: CGPoint, raio: CGFloat) {
    ctx.drawRadialGradient(
        g, startCenter: centro, startRadius: 0, endCenter: centro, endRadius: raio,
        options: [.drawsAfterEndLocation])
}

/// Estrela de quatro pontas (brilho), com as laterais côncavas.
func estrela(centro c: CGPoint, raio r: CGFloat, concavidade k: CGFloat) -> CGPath {
    let p = CGMutablePath()
    p.move(to: CGPoint(x: c.x, y: c.y - r))
    p.addQuadCurve(to: CGPoint(x: c.x + r, y: c.y), control: CGPoint(x: c.x + k * r, y: c.y - k * r))
    p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + r), control: CGPoint(x: c.x + k * r, y: c.y + k * r))
    p.addQuadCurve(to: CGPoint(x: c.x - r, y: c.y), control: CGPoint(x: c.x - k * r, y: c.y + k * r))
    p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - r), control: CGPoint(x: c.x - k * r, y: c.y - k * r))
    p.closeSubpath()
    return p
}

/// Esfera metálica escura com o brilho laranja e a estrela no centro.
func desenharEsfera(_ ctx: CGContext, centro c: CGPoint, diametro d: CGFloat, comSombra: Bool) {
    let r = d / 2
    let caixa = CGRect(x: c.x - r, y: c.y - r, width: d, height: d)
    let disco = CGPath(ellipseIn: caixa, transform: nil)

    // Brilho de destaque atrás da esfera (o botaoMetal faz o mesmo embaixo do botão).
    ctx.saveGState()
    let halo = gradiente([cor(laranja, 0.62), cor(laranja, 0.22), cor(laranja, 0)], [0, 0.55, 1])
    radial(ctx, halo, centro: CGPoint(x: c.x, y: c.y + d * 0.2), raio: d * 0.78)
    ctx.restoreGState()

    // Corpo: gradiente radial da esferaPreta, com a sombra projetada embaixo.
    ctx.saveGState()
    if comSombra {
        ctx.setShadow(offset: CGSize(width: 0, height: -d * 0.045), blur: d * 0.09, color: cor(0x000000, 0.4))
    }
    ctx.addPath(disco)
    ctx.setFillColor(cor(0x1f2121))
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(disco)
    ctx.clip()
    let corpo = gradiente(esferaPreta.map { cor($0) }, esferaPosicoes)
    radial(
        ctx, corpo,
        centro: CGPoint(x: caixa.minX + esferaCentro.x * d, y: caixa.minY + esferaCentro.y * d),
        raio: esferaRaio * d)

    // Reflexo laranja subindo da base da esfera.
    let reflexo = gradiente([cor(laranja, 0.55), cor(laranja, 0.18), cor(laranja, 0)], [0, 0.5, 1])
    radial(ctx, reflexo, centro: CGPoint(x: c.x, y: c.y + r * 1.02), raio: d * 0.62)

    // Luz suave no alto, à esquerda.
    let luz = gradiente([cor(0xffffff, 0.30), cor(0xffffff, 0)], [0, 1])
    radial(ctx, luz, centro: CGPoint(x: c.x - d * 0.16, y: c.y - d * 0.27), raio: d * 0.30)
    ctx.restoreGState()

    // Aro de luz na borda de cima (a sombra interna branca do estilo Esfera).
    ctx.saveGState()
    ctx.addPath(disco)
    ctx.setLineWidth(d * 0.012)
    ctx.replacePathWithStrokedPath()
    ctx.clip()
    let aro = gradiente([cor(0xffffff, 0.55), cor(0xffffff, 0.06), cor(laranja, 0.35)], [0, 0.55, 1])
    ctx.drawLinearGradient(
        aro, start: CGPoint(x: c.x, y: caixa.minY), end: CGPoint(x: c.x, y: caixa.maxY),
        // O traço passa meia espessura da caixa: sem estender, o topo e a base do aro sumiam.
        options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    ctx.restoreGState()

    // Estrela no centro, com brilho laranja em volta.
    let ponta = d * 0.31
    let forma = estrela(centro: CGPoint(x: c.x, y: c.y - d * 0.01), raio: ponta, concavidade: 0.13)
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: d * 0.11, color: cor(laranja, 0.9))
    ctx.addPath(forma)
    ctx.setFillColor(cor(laranja))
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(forma)
    ctx.clip()
    let metalLaranja = gradiente(
        [cor(0xffd2bd), cor(laranjaClaro), cor(laranja), cor(laranjaForte)], [0, 0.3, 0.62, 1])
    ctx.drawLinearGradient(
        metalLaranja,
        start: CGPoint(x: c.x - ponta * 0.35, y: c.y - ponta),
        end: CGPoint(x: c.x + ponta * 0.35, y: c.y + ponta), options: [])
    ctx.restoreGState()
}

// ---------- Saídas ----------

let lado = 1024
let pasta = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
let assets =
    CommandLine.arguments.count > 1
    ? URL(fileURLWithPath: CommandLine.arguments[1])
    : URL(fileURLWithPath: FileManager.default.currentDirectoryPath).deletingLastPathComponent()
_ = pasta

// Ícone: quadrado cheio e opaco; o iOS aplica a máscara dos cantos.
do {
    let ctx = novoContexto(lado: lado, opaco: true)
    let tela = CGFloat(lado)
    let fundo = gradiente([cor(fundoTopo), cor(fundoBase)], [0, 1])
    ctx.drawLinearGradient(fundo, start: .zero, end: CGPoint(x: 0, y: tela), options: [])
    desenharEsfera(ctx, centro: CGPoint(x: tela / 2, y: tela / 2), diametro: tela * 0.66, comSombra: true)
    salvar(ctx, em: assets.appendingPathComponent("icon.png").path)
}

// Splash: só a esfera, com folga em volta para o brilho; o fundo vem da cor do tema.
do {
    let ctx = novoContexto(lado: lado, opaco: false)
    let tela = CGFloat(lado)
    desenharEsfera(ctx, centro: CGPoint(x: tela / 2, y: tela / 2), diametro: tela * 0.56, comSombra: true)
    salvar(ctx, em: assets.appendingPathComponent("splash-icon.png").path)
}
