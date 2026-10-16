// GERADO por scripts/gerar.ts a partir de figma/variaveis.json. Não edite à mão.

export const ASSINATURA_FIGMA = '3eece74e';

export const neutros = {
  "claro": {
    "fundo": "#ececec",
    "superficie": "#f6f6f6",
    "superficie2": "#e2e3e3",
    "linha": "#d6d8d8",
    "texto": "#2a2c2c",
    "textoSuave": "#5f6363",
    "textoFraco": "#b3b6b6",
    "primario": "#141515",
    "primarioTexto": "#f6f6f6",
    "branco": "#ffffff"
  },
  "escuro": {
    "fundo": "#111213",
    "superficie": "#1b1c1e",
    "superficie2": "#0b0c0d",
    "linha": "#2a2c2f",
    "texto": "#ecedee",
    "textoSuave": "#8d9196",
    "textoFraco": "#55595e",
    "primario": "#ecedee",
    "primarioTexto": "#141515",
    "branco": "#ffffff"
  }
} as const;

export const aliasesDestaque = {
  "claro": {
    "destaque": "base",
    "destaqueSobre": "sobre",
    "destaqueTinta": "tintaClaro",
    "destaqueSuave": "suaveClaro",
    "destaqueGrafico": "graficoClaro",
    "destaqueBrilho": "brilho"
  },
  "escuro": {
    "destaque": "base",
    "destaqueSobre": "sobre",
    "destaqueTinta": "tintaEscuro",
    "destaqueSuave": "suaveEscuro",
    "destaqueGrafico": "base",
    "destaqueBrilho": "brilho"
  }
} as const;

export const destaques = {
  "laranja": {
    "base": "#ff5a1f",
    "sobre": "#1a0e08",
    "tintaClaro": "#b23a0b",
    "tintaEscuro": "#ff8a5c",
    "suaveClaro": "#ffe3d6",
    "suaveEscuro": "#3a2117",
    "graficoClaro": "#f03f00",
    "brilho": "#ff5a1f61"
  },
  "cobalto": {
    "base": "#2f5bff",
    "sobre": "#ffffff",
    "tintaClaro": "#2443cc",
    "tintaEscuro": "#8aa4ff",
    "suaveClaro": "#dde4ff",
    "suaveEscuro": "#1c2342",
    "graficoClaro": "#2f5bff",
    "brilho": "#2f5bff61"
  },
  "violeta": {
    "base": "#6b4bff",
    "sobre": "#ffffff",
    "tintaClaro": "#5b3fe0",
    "tintaEscuro": "#a893ff",
    "suaveClaro": "#e7e1ff",
    "suaveEscuro": "#262043",
    "graficoClaro": "#6b4bff",
    "brilho": "#6b4bff61"
  },
  "rosa": {
    "base": "#ff4fa3",
    "sobre": "#2a0616",
    "tintaClaro": "#b01a67",
    "tintaEscuro": "#ff8ac4",
    "suaveClaro": "#ffdcec",
    "suaveEscuro": "#3a1a2b",
    "graficoClaro": "#fc0078",
    "brilho": "#ff4fa361"
  },
  "menta": {
    "base": "#14a98b",
    "sobre": "#04201a",
    "tintaClaro": "#0a7461",
    "tintaEscuro": "#5fe0c4",
    "suaveClaro": "#d3f3ec",
    "suaveEscuro": "#12302a",
    "graficoClaro": "#119278",
    "brilho": "#14a98b61"
  },
  "lima": {
    "base": "#9ccb00",
    "sobre": "#1a2100",
    "tintaClaro": "#4a6600",
    "tintaEscuro": "#c8f03c",
    "suaveClaro": "#eef8c6",
    "suaveEscuro": "#2a3210",
    "graficoClaro": "#6b8b00",
    "brilho": "#9ccb0061"
  }
} as const;

export const gradientes = {
  "claro": {
    "esferaPreta": {
      "tipo": "radial",
      "cores": [
        "#5c6060",
        "#1f2121",
        "#060707"
      ],
      "posicoes": [
        0,
        0.45,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "esferaClara": {
      "tipo": "radial",
      "cores": [
        "#ffffff",
        "#eceded",
        "#c3c6c6"
      ],
      "posicoes": [
        0,
        0.55,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "esferaMedia": {
      "tipo": "radial",
      "cores": [
        "#e6e8e8",
        "#adb1b1",
        "#6e7272"
      ],
      "posicoes": [
        0,
        0.5,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "pilulaPreta": {
      "tipo": "linear",
      "cores": [
        "#3e4242",
        "#111212"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "barra": {
      "tipo": "linear",
      "cores": [
        "#4a4e4e",
        "#111212"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0,
        "y": 0.5
      },
      "fim": {
        "x": 1,
        "y": 0.5
      }
    },
    "metal": {
      "tipo": "linear",
      "cores": [
        "#e3e5e5",
        "#bcc0c0",
        "#979c9c"
      ],
      "posicoes": [
        0,
        0.5,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "aroMetal": {
      "tipo": "linear",
      "cores": [
        "#ffffff",
        "#9a9e9e",
        "#5f6464",
        "#d2d5d6"
      ],
      "posicoes": [
        0,
        0.45,
        0.85,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "bloco": {
      "tipo": "linear",
      "cores": [
        "#dedfdf",
        "#c9cbcb"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "capa": {
      "tipo": "linear",
      "cores": [
        "#f7f7f7",
        "#c8cbcb",
        "#edeeee",
        "#b9bdbd"
      ],
      "posicoes": [
        0,
        0.45,
        0.7,
        1
      ],
      "inicio": {
        "x": 0,
        "y": 0
      },
      "fim": {
        "x": 0.7143,
        "y": 0.7143
      }
    }
  },
  "escuro": {
    "esferaPreta": {
      "tipo": "radial",
      "cores": [
        "#ffffff",
        "#dadcdc",
        "#9a9e9e"
      ],
      "posicoes": [
        0,
        0.5,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "esferaClara": {
      "tipo": "radial",
      "cores": [
        "#5a5e62",
        "#2e3134",
        "#17191b"
      ],
      "posicoes": [
        0,
        0.55,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "esferaMedia": {
      "tipo": "radial",
      "cores": [
        "#9a9ea2",
        "#5e6266",
        "#2c2f32"
      ],
      "posicoes": [
        0,
        0.5,
        1
      ],
      "centro": {
        "x": 0.35,
        "y": 0.3
      },
      "raioX": 0.625,
      "raioY": 0.625
    },
    "pilulaPreta": {
      "tipo": "linear",
      "cores": [
        "#f4f5f5",
        "#c9cccc"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "barra": {
      "tipo": "linear",
      "cores": [
        "#c9cccc",
        "#f4f5f5"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0,
        "y": 0.5
      },
      "fim": {
        "x": 1,
        "y": 0.5
      }
    },
    "metal": {
      "tipo": "linear",
      "cores": [
        "#4b4f53",
        "#2f3235",
        "#1e2022"
      ],
      "posicoes": [
        0,
        0.5,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "aroMetal": {
      "tipo": "linear",
      "cores": [
        "#8a8f94",
        "#3a3d41",
        "#1a1c1e",
        "#3a3d41"
      ],
      "posicoes": [
        0,
        0.45,
        0.85,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "bloco": {
      "tipo": "linear",
      "cores": [
        "#2a2c2f",
        "#1f2123"
      ],
      "posicoes": [
        0,
        1
      ],
      "inicio": {
        "x": 0.5,
        "y": 0
      },
      "fim": {
        "x": 0.5,
        "y": 1
      }
    },
    "capa": {
      "tipo": "linear",
      "cores": [
        "#2e3134",
        "#121314",
        "#2a2d30",
        "#0e0f10"
      ],
      "posicoes": [
        0,
        0.45,
        0.7,
        1
      ],
      "inicio": {
        "x": 0,
        "y": 0
      },
      "fim": {
        "x": 0.7143,
        "y": 0.7143
      }
    }
  }
} as const;

export const sombras = {
  "claro": {
    "elevacao": [
      {
        "offsetX": 0,
        "offsetY": 10,
        "blurRadius": 24,
        "spreadDistance": 0,
        "color": "#00000012"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#0000000d"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 0,
        "spreadDistance": 0,
        "color": "#ffffffe5",
        "inset": true
      }
    ],
    "afundado": [
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 5,
        "spreadDistance": 0,
        "color": "#00000017",
        "inset": true
      },
      {
        "offsetX": 0,
        "offsetY": -1,
        "blurRadius": 0,
        "spreadDistance": 0,
        "color": "#ffffffcc",
        "inset": true
      }
    ],
    "esfera": [
      {
        "offsetX": 0,
        "offsetY": 8,
        "blurRadius": 16,
        "spreadDistance": 0,
        "color": "#00000038"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#0000001f"
      },
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#ffffff4d",
        "inset": true
      }
    ],
    "esferaClara": [
      {
        "offsetX": 0,
        "offsetY": 6,
        "blurRadius": 14,
        "spreadDistance": 0,
        "color": "#0000001f"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#00000014"
      },
      {
        "offsetX": 0,
        "offsetY": -2,
        "blurRadius": 3,
        "spreadDistance": 0,
        "color": "#0000000f",
        "inset": true
      }
    ],
    "botaoMetal": [
      {
        "offsetX": 0,
        "offsetY": 16,
        "blurRadius": 32,
        "spreadDistance": 0,
        "color": "#ff5a1f61",
        "variavel": "destaqueBrilho"
      },
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 4,
        "spreadDistance": 0,
        "color": "#0000001f"
      },
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 1,
        "spreadDistance": 0,
        "color": "#ffffffb2",
        "inset": true
      }
    ]
  },
  "escuro": {
    "elevacao": [
      {
        "offsetX": 0,
        "offsetY": 10,
        "blurRadius": 24,
        "spreadDistance": 0,
        "color": "#00000080"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#00000066"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 0,
        "spreadDistance": 0,
        "color": "#ffffff0f",
        "inset": true
      }
    ],
    "afundado": [
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 5,
        "spreadDistance": 0,
        "color": "#000000b2",
        "inset": true
      },
      {
        "offsetX": 0,
        "offsetY": -1,
        "blurRadius": 0,
        "spreadDistance": 0,
        "color": "#ffffff0f",
        "inset": true
      }
    ],
    "esfera": [
      {
        "offsetX": 0,
        "offsetY": 8,
        "blurRadius": 16,
        "spreadDistance": 0,
        "color": "#0000008c"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#00000066"
      },
      {
        "offsetX": 0,
        "offsetY": -2,
        "blurRadius": 3,
        "spreadDistance": 0,
        "color": "#00000040",
        "inset": true
      }
    ],
    "esferaClara": [
      {
        "offsetX": 0,
        "offsetY": 6,
        "blurRadius": 14,
        "spreadDistance": 0,
        "color": "#00000080"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "#00000059"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 1,
        "spreadDistance": 0,
        "color": "#ffffff1f",
        "inset": true
      }
    ],
    "botaoMetal": [
      {
        "offsetX": 0,
        "offsetY": 16,
        "blurRadius": 32,
        "spreadDistance": 0,
        "color": "#ff5a1f61",
        "variavel": "destaqueBrilho"
      },
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 4,
        "spreadDistance": 0,
        "color": "#00000066"
      },
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 1,
        "spreadDistance": 0,
        "color": "#ffffff26",
        "inset": true
      }
    ]
  }
} as const;

export const tipografia = {
  "display": {
    "fontFamily": "PlusJakartaSans-Bold",
    "fontSize": 28,
    "lineHeight": 34,
    "letterSpacing": -0.56
  },
  "titulo": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 22,
    "lineHeight": 28,
    "letterSpacing": -0.22
  },
  "secao": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 17,
    "lineHeight": 22,
    "letterSpacing": -0.085
  },
  "numero": {
    "fontFamily": "PlusJakartaSans-Bold",
    "fontSize": 22,
    "lineHeight": 26,
    "letterSpacing": -0.22
  },
  "botao": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 18,
    "lineHeight": 22,
    "letterSpacing": -0.09
  },
  "corpo": {
    "fontFamily": "PlusJakartaSans-Regular",
    "fontSize": 15,
    "lineHeight": 21,
    "letterSpacing": 0
  },
  "corpoForte": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 15,
    "lineHeight": 21,
    "letterSpacing": 0
  },
  "legenda": {
    "fontFamily": "PlusJakartaSans-Medium",
    "fontSize": 13,
    "lineHeight": 18,
    "letterSpacing": 0
  },
  "mini": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 11,
    "lineHeight": 14,
    "letterSpacing": 0.44
  },
  "iniciais": {
    "fontFamily": "PlusJakartaSans-SemiBold",
    "fontSize": 15,
    "lineHeight": 18,
    "letterSpacing": 0
  }
} as const;
