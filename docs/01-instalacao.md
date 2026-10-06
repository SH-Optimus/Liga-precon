# 01 · Instalação

Este guia cobre a instalação na **HostGator** (como está hoje em `luiz-fernando.com/mtg/`) e em **outros servidores**: outras hospedagens com cPanel, servidor próprio com Apache ou Nginx, e Docker.

- [Requisitos](#requisitos)
- [Como os arquivos ficam no servidor](#como-os-arquivos-ficam-no-servidor)
- [HostGator (cPanel) passo a passo](#hostgator-cpanel-passo-a-passo)
- [Outras hospedagens com cPanel ou painel parecido](#outras-hospedagens-com-cpanel-ou-painel-parecido)
- [Servidor próprio com Apache](#servidor-próprio-com-apache)
- [Servidor próprio com Nginx](#servidor-próprio-com-nginx)
- [Docker](#docker)
- [Hospedagens que não servem](#hospedagens-que-não-servem)
- [Primeiro acesso (criar o login da organização)](#primeiro-acesso)
- [Atualizar o sistema](#atualizar-o-sistema)
- [Backup, restauração e mudança de servidor](#backup-restauração-e-mudança-de-servidor)
- [Testar no próprio computador](#testar-no-próprio-computador)

---

## Requisitos

| Item | Mínimo | Observação |
|---|---|---|
| PHP | **8.1** ou mais novo | Testado em 8.3 e 8.4 |
| Extensões PHP | `pdo_sqlite`, `mbstring`, `json` | Vêm ligadas na maioria das hospedagens |
| Banco de dados | nenhum para instalar | Usa **SQLite**: um arquivo que o próprio sistema cria |
| Servidor web | Apache (com `.htaccess`) ou Nginx | Em Nginx as regras de proteção são escritas na configuração |
| HTTPS | recomendado | O login da organização usa cookie seguro quando há HTTPS |
| Espaço | ~5 MB + o banco | O banco de uma temporada inteira fica abaixo de 1 MB |

Não precisa de MySQL, Composer, Node.js nem nenhuma instalação no servidor: é só copiar os arquivos.

---

## Como os arquivos ficam no servidor

O pacote `dist/liga.zip` é extraído **dentro da pasta onde o site vai morar** (na HostGator, `public_html/mtg`):

```
public_html/mtg/
├── index.html          página do ranking
├── ranking/            CSS, JavaScript, dados de 2025 e artes dos comandantes
└── liga/               sistema de eventos
    ├── index.html      página pública
    ├── admin.html      painel da organização
    ├── tv.html         modo TV
    ├── api.php
    ├── assets/
    └── lib/            (bloqueada: config, regras e histórico importado)

/home/<usuario>/liga-data/
└── liga.sqlite         ← TODOS os dados (fora da pasta pública)
```

O banco fica **fora** de `public_html`, onde ninguém de fora consegue baixar. O caminho é definido em `liga/lib/config.php`:

```php
const DATA_DIR = __DIR__ . '/../../../../liga-data';
```

Isso significa “4 pastas acima de `liga/lib`”. Com a instalação em `public_html/mtg/liga/lib`, o resultado é `/home/<usuario>/liga-data`. **Se instalar em outra profundidade** (por exemplo direto em `public_html/liga`), ajuste o número de `../` para continuar caindo fora da pasta pública — ou defina a variável de ambiente `LIGA_DATA_DIR` (ver [Docker](#docker)).

---

## HostGator (cPanel) passo a passo

### 1. Conferir a versão do PHP
1. No cPanel, abra **Software → Selecionar versão do PHP** (ou **MultiPHP Manager**).
2. Garanta **PHP 8.1 ou mais novo** para o domínio. Hoje a conta está em 8.4.
3. Se houver a aba **Extensões**, confirme `pdo_sqlite` e `mbstring` marcadas.

> Não é preciso criar banco de dados no phpMyAdmin. O banco `luiz9396_renascer` que aparece lá é de outro site; não mexa nele.

### 2. Enviar e extrair o pacote
1. No **Gerenciador de arquivos**, entre em `public_html/mtg` (crie a pasta `mtg` se for a primeira vez).
2. **Carregar** → escolha `liga.zip` → espere 100% → **Voltar**.
3. Selecione `liga.zip` → **Extrair** → confirme `/public_html/mtg` → **Extract Files**. O cPanel substitui arquivos existentes sem perguntar.
4. Exclua o `liga.zip` da pasta.

### 3. Conferir as proteções
1. **Configurações** (canto superior direito) → marque **Mostrar arquivos ocultos (dotfiles)**.
2. Devem existir `mtg/liga/.htaccess` e `mtg/liga/lib/.htaccess`.
3. Abra `https://seudominio/mtg/liga/lib/config.php` no navegador: tem que aparecer **Forbidden** (403). Se abrir qualquer outra coisa, **não use o sistema** antes de resolver.

### 4. Política de segurança (CSP)
A conta tem, no `public_html/.htaccess`, uma política que só permite scripts e estilos em arquivos próprios. O sistema e a página do ranking já são feitos para ela: não precisam de exceção.

Se existir um `mtg/.htaccess` antigo com a exceção (`'unsafe-inline'`), **renomeie** para `htaccess-antigo.txt` e confira o site. Se algo quebrar, renomeie de volta e avise quem faz a manutenção.

### 5. Primeiro acesso
Siga [Primeiro acesso](#primeiro-acesso).

---

## Outras hospedagens com cPanel ou painel parecido

Hostinger (hPanel), Locaweb, KingHost, UOL Host, GoDaddy, Hostgator de outros países e similares funcionam do mesmo jeito:

1. Ative **PHP 8.1+** no seletor de versão do painel.
2. Envie `liga.zip` para a pasta do site (`public_html/mtg`, `www/mtg`, `htdocs/mtg`…) e extraia.
3. Confira que `.../liga/lib/config.php` responde **403**. Algumas hospedagens ignoram `.htaccess` (as que usam Nginx puro): nesse caso peça ao suporte para bloquear a pasta `liga/lib` ou veja [Nginx](#servidor-próprio-com-nginx).
4. Confira se a pasta de dados ficou fora da área pública (ver [Como os arquivos ficam no servidor](#como-os-arquivos-ficam-no-servidor)). Em painéis onde a raiz pública é `/home/usuario/domains/site/public_html`, os 4 níveis acima de `lib` continuam fora da área pública; confira mesmo assim.

---

## Servidor próprio com Apache

1. Copie o conteúdo de `liga.zip` para a pasta do site, ex.: `/var/www/site/mtg/`.
2. Crie a pasta de dados fora da raiz pública e dê permissão ao usuário do PHP:
   ```bash
   sudo mkdir -p /var/www/liga-data && sudo chown www-data: /var/www/liga-data
   ```
   e ajuste `DATA_DIR` em `liga/lib/config.php` (ou use `SetEnv LIGA_DATA_DIR /var/www/liga-data` no VirtualHost).
3. Permita `.htaccess` na pasta do site (senão as proteções não valem):
   ```apache
   <Directory /var/www/site>
       AllowOverride All
   </Directory>
   ```
4. Recomendado: HTTPS (Let’s Encrypt/certbot) e o cabeçalho de segurança (precisa de `a2enmod headers`):
   ```apache
   Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
   ```

---

## Servidor próprio com Nginx

Nginx não lê `.htaccess`: as proteções vão na configuração do site. Exemplo com PHP-FPM, site em `/var/www/site` e o sistema em `/mtg/`:

```nginx
server {
    server_name seudominio.com.br;
    root /var/www/site;
    index index.html index.php;

    # Proteções (equivalentes aos .htaccess do pacote)
    location ^~ /mtg/liga/lib/ { deny all; }
    location ~* \.(sqlite|json|md|py)$ { deny all; }
    location ^~ /mtg/ranking/ { }            # ranking/dados-2025.json precisa ser público
    location = /mtg/ranking/dados-2025.json { allow all; }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param LIGA_DATA_DIR /var/www/liga-data;
    }

    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
}
```

> Atenção à regra de `.json`: a página do ranking carrega `mtg/ranking/dados-2025.json`. Se a sua regra bloquear todo `.json`, libere esse arquivo como no exemplo.

Crie `/var/www/liga-data` com dono `www-data` e teste `https://seudominio/mtg/liga/lib/config.php` → **403**.

---

## Docker

Para rodar em qualquer máquina com Docker (VPS, servidor da loja, etc.):

```dockerfile
# Dockerfile
FROM php:8.3-apache
RUN a2enmod headers && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
COPY mtg/ /var/www/html/mtg/
ENV LIGA_DATA_DIR=/data
RUN mkdir /data && chown www-data: /data
VOLUME /data
```

```bash
unzip dist/liga.zip -d mtg
docker build -t liga-precon .
docker run -d --name liga -p 80:80 -v liga-dados:/data liga-precon
```

O volume `liga-dados` guarda o banco; pode atualizar a imagem à vontade sem perder dados. O token de configuração do primeiro acesso pode vir por variável: `-e LIGA_SETUP_TOKEN=...`.

---

## Hospedagens que não servem

- **Só arquivos estáticos** (GitHub Pages, Netlify/Vercel sem funções, Google Sites): não rodam PHP. Nem o sistema nem a página do ranking funcionam (a página busca os dados na API do sistema).
- **PHP sem permissão de escrita fora da pasta pública**: ajuste `DATA_DIR` para uma pasta gravável e proteja-a (no Apache, um `.htaccess` com `Require all denied` dentro dela).

---

## Primeiro acesso

1. Abra `https://seudominio/mtg/liga/admin.html`. Aparece **Configurar o sistema**.
2. O **token de configuração** está em `liga/lib/config.php`, na linha `const SETUP_TOKEN = '...'` (no cPanel: selecione o arquivo → **Editar** ou **Exibir**). Cada pacote gerado tem um token novo; ele só serve até o primeiro login ser criado.
3. Preencha token, usuário e senha (mínimo 8 caracteres) → **Criar**.
4. Outros organizadores: painel → **Organizadores** → usuário e senha → **Salvar organizador** (também troca a senha de um existente).

Na primeira vez que o sistema roda, ele cria `liga-data/liga.sqlite` e importa o histórico das etapas que vieram no pacote (planilha da liga e planilha de mesas).

---

## Atualizar o sistema

1. Gere o pacote novo (`python3 tools/package.py`) ou use o `dist/liga.zip` que recebeu.
2. Envie para `mtg` e **extraia por cima**.
3. Pronto. O que acontece com os dados:
   - **Nada é apagado.** O banco fica em `liga-data`, fora do pacote.
   - Colunas e tabelas novas são criadas sozinhas na primeira visita (migração automática).
   - O `config.php` é substituído (com um token novo, que não importa depois do primeiro login). Se você mudou alguma regra em `config.php` no servidor, refaça a mudança no projeto antes de gerar o pacote — veja [06 · Personalização](06-personalizacao.md#regras-da-liga).
4. Os arquivos de estilo e script levam a versão no endereço (`app.css?v=...`), então os navegadores baixam a versão nova sozinhos. Só a página do ranking (`mtg/index.html`) pode pedir um **Ctrl+Shift+R** quando muda de formato.

---

## Backup, restauração e mudança de servidor

**Backup:** painel da organização → **Backup e exportação** → **💾 Banco completo**. Baixa uma cópia consistente de tudo (`liga-precon-backup-AAAA-MM-DD.sqlite`). Recomendado depois de cada etapa, guardando no Drive da liga.

**Restaurar:**
1. Renomeie o backup para `liga.sqlite`.
2. No servidor, substitua o arquivo em `liga-data/` (se existirem `liga.sqlite-wal` e `liga.sqlite-shm` ao lado, apague-os junto).
3. Recarregue o site.

**Mudar de servidor:** instale o pacote no servidor novo, copie o `liga.sqlite` (ou um backup) para a pasta de dados dele e pronto — os logins da organização vêm junto.

---

## Testar no próprio computador

Com Docker instalado, na pasta do projeto:

```bash
docker run --rm -p 8780:8080 -e LIGA_DATA_DIR=/tmp/liga -e LIGA_SETUP_TOKEN=teste -v "$PWD":/app -w /app php:8.4-cli php -S 0.0.0.0:8080 tests/router_mtg.php
```

Abra `http://127.0.0.1:8780/` (página do ranking) e `http://127.0.0.1:8780/liga/admin.html` (token: `teste`). O roteador `tests/router_mtg.php` imita a estrutura e a política de segurança do servidor da HostGator. O banco de teste fica dentro do contêiner e some quando ele para.
