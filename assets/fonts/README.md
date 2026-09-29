# Bundled fonts

The renderer uses these two Simplified Chinese subset fonts from the official [Noto CJK repository](https://github.com/notofonts/noto-cjk):

| File | Official source | SHA-256 |
| --- | --- | --- |
| NotoSansSC-Regular.otf | [Sans subset](https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf) | `FAA6C9DF652116DDE789D351359F3D7E5D2285A2B2A1F04A2D7244DF706D5EA9` |
| NotoSerifSC-Regular.otf | [Serif subset](https://github.com/notofonts/noto-cjk/blob/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf) | `E8F396DECC1F0963A016A989C3D8852E863D1350996F573860A80767C83A1CD3` |

The fonts are distributed under the SIL Open Font License 1.1. The license texts are included as `LICENSE-SANS` and `LICENSE-SERIF`.

`fonts.conf` makes fontconfig discover this directory by a path relative to the config file. The renderer sets `FONTCONFIG_FILE` and `FONTCONFIG_PATH` before the first render. Sharp uses fontconfig for both SVG text and text measurement.
