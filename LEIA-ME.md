# Game Collection — versão APK (Android)

Esta é a sua aplicação de coleção de games reescrita para rodar **direto no celular**,
sem PHP, sem MySQL e sem internet. Os dados ficam salvos no próprio aparelho.

## O que mudou em relação à versão PHP

| Versão PHP/MySQL | Versão APK |
|---|---|
| Banco MySQL no servidor | Banco local no celular (IndexedDB) |
| Login com usuário e senha | Sem login (o app é só seu, no seu celular) |
| Foto pela webcam | Botões **Câmera** e **Galeria** do celular |
| Backup em arquivo .sql no servidor | Backup em arquivo .json com fotos, enviado pelo "Compartilhar" (Drive, WhatsApp, e-mail…) |
| Total investido = consoles + jogos | Total investido = consoles + jogos + acessórios (com o detalhe de cada um) |

Também ganhou busca e filtro de jogos/acessórios por console.

---

## Como gerar o APK (sem instalar nada no computador)

O GitHub compila o APK para você, de graça.

1. Crie uma conta em <https://github.com> (se ainda não tiver).
2. Clique em **New repository**, dê um nome (ex.: `gamecollection`), deixe **Private** e crie.
3. Na página do repositório, clique em **uploading an existing file** e arraste
   **todo o conteúdo desta pasta** (inclusive a pasta `.github`). Clique em **Commit changes**.
   - Dica: se o navegador não mostrar a pasta `.github` (pastas com ponto ficam ocultas),
     use o GitHub Desktop, ou crie o arquivo manualmente em
     **Add file → Create new file** com o nome `.github/workflows/build-apk.yml`
     e cole o conteúdo do arquivo.
4. Vá na aba **Actions**. A compilação "Gerar APK" começa sozinha (leva uns 5 minutos).
5. Quando ficar verde ✅, clique nela e, lá embaixo em **Artifacts**, baixe
   **GameCollection-APK**. Dentro do .zip está o `GameCollection.apk`.
6. Passe o APK para o celular e abra. O Android vai pedir para permitir
   "instalar apps de fontes desconhecidas" — permita para o app que você usou para abrir o arquivo.

Sempre que você alterar algo e enviar ao GitHub, um APK novo é gerado. Como todos usam a
mesma assinatura (`android-keystore/debug.keystore`), você instala por cima **sem perder os dados**.

## Alternativa: Android Studio no seu computador

1. Instale o [Node.js](https://nodejs.org) e o [Android Studio](https://developer.android.com/studio).
2. Abra um terminal nesta pasta e rode:
   ```
   npm install
   npx cap add android
   npx capacitor-assets generate --android
   npm run android
   ```
3. O Android Studio abre o projeto. Use **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

## Trazendo a coleção atual

Junto com este projeto vai o arquivo **`minha-colecao.json`**, convertido do seu último backup
(6 consoles, 2 jogos, 1 acessório, com as fotos). No app: aba **Backup → Restaurar backup** → escolha o arquivo.

## Importante

Os dados ficam só no celular. Se desinstalar o app ou "limpar dados", a coleção some.
Use **Backup → Exportar backup** de vez em quando e guarde o arquivo no Drive.

## Estrutura

```
www/            o app (index.html, style.css, app.js)
resources/      ícone e tela de abertura
android-keystore/  assinatura fixa para atualizar sem perder dados
.github/workflows/build-apk.yml   receita que o GitHub usa para gerar o APK
capacitor.config.json / package.json   configuração do Capacitor
```

Para testar no computador sem gerar APK, basta abrir `www/index.html` com um servidor local
(ex.: `npx serve www`).
