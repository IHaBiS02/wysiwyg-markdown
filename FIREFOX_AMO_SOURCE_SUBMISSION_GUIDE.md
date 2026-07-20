# SideNote Firefox AMO 소스 코드 제출 및 재현 빌드 가이드

> 정책 확인일: 2026-07-20  
> 대상 SideNote 버전: 4.2.10  
> 이 문서는 Mozilla의 공식 정책과 현재 `wysiwyg-markdown`/`SideNote` 빌드 구조를 함께 분석한 결과다. AMO 정책과 기본 심사 환경은 바뀔 수 있으므로 실제 제출 직전에 링크된 공식 문서를 다시 확인한다.

## 1. 결론

SideNote는 Firefox Add-ons(AMO)에 확장 패키지와 별도로 **빌드 전 원본 소스 패키지를 제출해야 하는 경우**에 해당한다.

이유는 다음과 같다.

- `wysiwyg-markdown`의 TypeScript 소스가 Vite/Rollup/esbuild를 거쳐 하나의 `wysiwyg-markdown.js`로 번들링·축소된다.
- `SideNote/build.js`가 원본 파일을 복사하고 Firefox용 `manifest.json`을 생성하며, npm 패키지의 축소된 라이브러리 파일들을 확장 패키지에 넣는다.
- Mozilla는 minifier, bundler, template engine 또는 파일을 전처리하여 배포 파일을 만드는 사용자 정의 도구를 사용했다면 원본 소스와 재현 빌드 지침을 요구한다.

따라서 AMO에는 버전마다 아래 두 파일을 함께 제출하는 구성이 적절하다.

1. 사용자에게 배포할 확장 패키지: `firefox-4_2_10.zip`
2. 관리자 심사용 소스 패키지: `sidenote-4.2.10-source.zip`

소스 패키지에는 `node_modules`를 넣는 것이 아니라, 공개 npm 레지스트리에서 같은 버전을 다시 설치할 수 있도록 **두 프로젝트의 원본 소스, 빌드 스크립트, `package.json`, `package-lock.json`, 설정 파일과 영문 빌드 README**를 넣는 것을 권장한다.

## 2. Mozilla 공식 정책 요약

### 2.1 소스 제출이 필요한 조건

Mozilla는 축소, 여러 파일의 단일 파일 번들링, 템플릿 처리, 기타 사용자 정의 전처리로 확장 파일을 생성한 경우 원본 소스 제출을 요구한다. 심사자는 제출된 지침으로 확장을 다시 빌드한 뒤 배포 패키지의 파일과 diff를 비교하며, 생성 결과에 차이가 없어야 한다. 빌드 도구는 오픈 소스이고 로컬에서 실행 가능해야 한다. 또한 lockfile을 포함해야 한다. 자세한 기준은 [Mozilla Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)에 정리되어 있다.

Mozilla의 [Add-on Policies 3.1](https://extensionworkshop.com/documentation/publish/add-on-policies/#3-1-source-code-submission)은 다음을 요구한다.

- transpile, minify 또는 기계 생성 전의 검토 가능한 소스를 제공한다.
- 제출한 소스로 배포 결과를 재현하는 지침을 제공한다.
- 모든 의존성은 소스 패키지에 직접 포함하거나, 빌드 중 해당 공식 패키지 관리자를 통해서만 내려받는다.
- 더 이상 유지보수되지 않는 빌드 도구나 환경은 허용되지 않는다.
- 난독화는 금지되지만 파일 크기를 줄이기 위한 축소와 번들링은 원본 소스를 함께 내면 허용된다.

제출한 소스는 소수의 관리자 심사자만 접근하며 재배포되지 않는다. 소스 패키지 최대 크기는 200MB이고, 필요한 경우 **모든 새 확장 버전에 그 버전과 일치하는 소스를 첨부**해야 한다.

### 2.2 README와 빌드 스크립트에 필요한 정보

Mozilla가 요구하는 핵심 항목은 다음과 같다.

- 빌드에 사용한 운영체제와 CPU 아키텍처
- Node.js, npm 등 도구의 정확한 버전
- 도구 설치 방법과 공식 다운로드 링크
- 확장 패키지를 생성하는 모든 명령
- 가능하면 전체 과정을 한 번에 실행하는 빌드 스크립트
- npm의 `package-lock.json`과 같은 버전 lockfile
- 비공개 저장소나 자체 프레임워크를 사용했다면 그 소스
- 빌드 결과가 생성되는 상대 경로

현재 Mozilla의 기본 심사 환경은 다음과 같다.

- Ubuntu 24.04.4 LTS Desktop
- ARM64
- Node.js 24.14.0
- npm 11.9.0
- RAM 10GB, vCPU 6개, 여유 디스크 35GB

이 환경과 다르게 빌드했다면 소스 패키지 README에 차이를 명시해야 한다. 가장 안전한 방법은 SideNote 릴리스 빌드도 위 Node/npm 버전으로 맞추고 Linux ARM64에서도 같은 파일 내용이 생성되는지 검증하는 것이다.

### 2.3 제3자 라이브러리

Mozilla의 [Third Party Library Usage](https://extensionworkshop.com/documentation/publish/third-party-library-usage/)에 따르면 제3자 라이브러리는 정확한 릴리스 버전의 원본 파일과 읽을 수 있는 소스 위치를 심사자가 확인할 수 있어야 한다.

기본 npm 설정을 사용한다면 `package.json`의 의존성 선언이 라이브러리 링크 역할을 하고, `package-lock.json`이 정확한 배포 버전과 무결성 해시를 고정한다. SideNote의 의존성은 공개 npm 패키지이므로 일반적으로 `node_modules`를 소스 ZIP에 넣을 필요가 없다. 다음 조건은 지켜야 한다.

- 설치는 `npm ci`와 공식 npm 레지스트리를 사용한다.
- 사설 레지스트리나 비공개 패키지를 새로 사용하면 해당 소스도 제출 패키지에 포함한다.
- `node_modules`의 라이브러리 파일을 직접 수정하지 않는다.
- AMO의 **Notes for Reviewers**에 두 `package.json`을 통해 의존성을 받는다는 점과 주요 번들 라이브러리를 설명한다.
- 현재 포함된 `LIBRARY_LICENSES.md`와 `WYSIWYG_MARKDOWN_LICENSES.md`는 유지한다. 단, 라이선스 목록은 원본 소스와 빌드 지침을 대신하지 않는다.

`@highlightjs/cdn-assets`라는 패키지 이름에 `cdn`이 들어가지만 현재 빌드는 CDN에서 실행 코드를 받지 않고 npm 설치 결과의 `highlight.min.js`를 로컬 확장 패키지로 복사한다. 이 설치 경로를 유지해야 한다.

## 3. 현재 SideNote 빌드 구조 분석

현재 빌드는 두 단계다.

```text
wysiwyg-markdown/src/*.ts
  -> npm run build (Vite + TypeScript)
  -> dist/wysiwyg-markdown.js
  -> npm run sync:sidenote
  -> SideNote/vendor/wysiwyg-markdown.js
  -> SideNote/build.js
  -> SideNote/build/firefox/*
  -> SideNote/build/firefox-4_2_10.zip
```

### 3.1 WYSIWYG 에디터 빌드

상위 `wysiwyg-markdown` 프로젝트에서 다음 파일들이 에디터 번들을 만든다.

- `src/**/*.ts`: 사람이 읽을 수 있는 에디터 원본
- `vite.config.ts`: 단일 ES 모듈 번들, esbuild 축소, sourcemap 설정
- `tsconfig.json`, `tsconfig.build.json`: TypeScript 설정
- `scripts/generate-third-party-licenses.mjs`: 런타임 의존성 라이선스 생성
- `scripts/sync-sidenote.mjs`: 생성된 번들과 라이선스를 SideNote에 복사
- `package.json`, `package-lock.json`: 빌드 도구와 런타임 의존성 고정

`SideNote/vendor/wysiwyg-markdown.js`는 제3자 라이브러리가 아니라 이 프로젝트의 **기계 생성된 first-party 코드**다. 이 파일만 제출하면 안 되고, 반드시 위 TypeScript 원본과 빌드 설정을 함께 제출해야 한다.

### 3.2 SideNote 확장 빌드

`SideNote/build.js`는 다음 작업을 한다.

- 공통 JS, HTML, CSS, 이미지와 라이선스 파일을 Chrome/Firefox 출력 폴더로 복사
- `node_modules`에서 DOMPurify, Marked, Highlight.js, JSZip, browser-polyfill 등의 고정된 배포 파일 복사
- Chrome manifest를 기반으로 Firefox용 background script, `sidebar_action`, Gecko ID와 데이터 수집 권한 생성
- `build/firefox-<version>.zip` 생성

현재 버전은 `SideNote/package.json`과 `SideNote/manifest.json` 모두 `4.2.10`으로 일치한다.

### 3.3 현재 상태에서 보완이 필요한 부분

현재 상태 그대로도 수동 명령으로 빌드할 수 있지만, AMO 재현 빌드 제출 관점에서는 다음을 보완하는 편이 안전하다.

1. **SideNote 저장소만으로 에디터 번들을 재생성할 수 없다.**  
   현재 SideNote 릴리스 워크플로는 SideNote 저장소만 checkout하고 이미 들어 있는 `vendor/wysiwyg-markdown.js`를 사용한다. 소스 제출 ZIP은 반드시 상위 에디터 원본까지 포함해야 한다.

2. **릴리스 빌드 환경이 고정되어 있지 않다.**  
   현재 GitHub Actions는 `windows-latest`와 Node 22를 사용하지만 정확한 Node 22 패치 버전과 npm 버전은 고정하지 않는다. 현재 로컬 확인 환경도 Node 24.16.0/npm 12.0.0으로 Mozilla 기본 환경과 다르다.

3. **심사자용 단일 진입점이 없다.**  
   심사자가 두 프로젝트의 설치·동기화·패키징 순서를 알아서 조합하지 않도록 루트에 한 개의 빌드 명령을 제공해야 한다.

4. **출력 폴더를 먼저 비워야 한다.**  
   `SideNote/build.js`는 기존 출력 폴더의 불필요한 파일을 모두 제거하지 않는다. 항상 `npm run clean --prefix SideNote` 후 빌드해야 stale 파일이 배포물에 섞이지 않는다.

5. **ZIP 자체의 바이트 단위 재현성은 별도 확인이 필요하다.**  
   `archiver`가 파일 시각 같은 ZIP 메타데이터를 기록하면 내부 파일이 같아도 ZIP SHA-256은 달라질 수 있다. Mozilla의 핵심 확인 대상은 다시 생성된 확장 파일들의 diff지만, 가능하면 파일 순서와 timestamp도 정규화하여 ZIP 자체도 결정적으로 만드는 것이 좋다.

## 4. 권장 소스 제출 패키지 구조

단기적으로 저장소 구조를 바꾸지 않고 아래와 같은 한 개의 ZIP을 생성한다.

```text
sidenote-4.2.10-source/
├─ README-AMO.md
├─ BUILD_METADATA.json
├─ package.json
├─ package-lock.json
├─ vite.config.ts
├─ tsconfig.json
├─ tsconfig.build.json
├─ LICENSE
├─ src/
├─ scripts/
│  ├─ generate-third-party-licenses.mjs
│  ├─ sync-sidenote.mjs
│  ├─ build-amo.mjs
│  └─ create-amo-source-package.mjs
└─ SideNote/
   ├─ package.json
   ├─ package-lock.json
   ├─ manifest.json
   ├─ build.js
   ├─ background.js
   ├─ sidepanel.html
   ├─ sidepanel.css
   ├─ dark_mode.css
   ├─ LICENSE
   ├─ LIBRARY_LICENSES.md
   ├─ src/
   └─ images/
```

`BUILD_METADATA.json`에는 최소한 다음을 기록하는 것이 좋다.

```json
{
  "sidenoteVersion": "4.2.10",
  "editorVersion": "0.1.0",
  "editorCommit": "<wysiwyg-markdown commit SHA>",
  "sidenoteCommit": "<SideNote commit SHA>",
  "node": "24.14.0",
  "npm": "11.9.0"
}
```

다음 항목은 소스 패키지에서 제외한다.

- 두 저장소의 `.git/`
- `node_modules/`
- 기존 `dist/`, `build/`, coverage, 임시 캐시
- 기존 `SideNote/vendor/wysiwyg-markdown.js`: 심사 빌드가 원본에서 다시 생성해야 함
- 스크린샷, 개인 메모, 대화 기록, 에디터 설정, 비밀키
- 제출 빌드에 필요하지 않은 `chrome-4_1_14` 참조 폴더

소스 압축 스크립트는 제외 목록에 의존하기보다 위 파일만 복사하는 **allow-list 방식**으로 만드는 것이 안전하다. 그래야 나중에 토큰, 로컬 설정 또는 큰 테스트 산출물이 실수로 제출되지 않는다.

## 5. 권장 재현 빌드 명령

소스 ZIP을 새 폴더에 푼 직후 다음 네 명령만으로 결과가 생성되어야 한다.

```bash
npm ci
npm ci --prefix SideNote
npm run clean --prefix SideNote
npm run build:amo
```

아직 `build:amo`는 존재하지 않으므로 구현할 때 상위 `package.json`에 추가하고, 내부적으로 다음 순서를 실행하게 한다.

```text
1. npm run sync:sidenote
   - 에디터 라이선스 생성
   - Vite로 에디터 번들 생성
   - SideNote/vendor/wysiwyg-markdown.js로 복사
2. npm run build --prefix SideNote
   - Firefox용 manifest 및 전체 확장 디렉터리 생성
   - Firefox ZIP 생성
3. 결과 파일과 버전을 출력
```

성공 시 심사자에게 안내할 결과는 다음과 같다.

```text
SideNote/build/firefox/                 # diff하기 쉬운 비압축 결과
SideNote/build/firefox-4_2_10.zip       # AMO에 올린 확장 패키지와 같은 내용
```

심사 과정에 꼭 필요하지 않은 테스트는 필수 빌드 명령과 분리하되, 제출 전에는 다음을 실행한다.

```bash
npm run test:run
npm run typecheck
npm run test:run --prefix SideNote
```

Firefox 패키지는 Mozilla 공식 도구인 `web-ext lint`로 확인하는 것이 좋다. `web-ext` 버전도 devDependency/lockfile로 고정한 뒤 다음과 같은 npm script로 실행하면 전역 설치에 의존하지 않는다. 사용법은 [Getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)를 참고한다.

```bash
npx web-ext lint --source-dir SideNote/build/firefox
```

## 6. 배포 패키지와 재빌드 결과 검증

제출 전에는 반드시 **AMO에 실제로 업로드할 ZIP**을 보관하고, 별도의 깨끗한 폴더 또는 CI에서 소스 ZIP만 사용해 다시 빌드한다.

검증 순서는 다음과 같다.

1. 릴리스 태그/커밋에서 확장 ZIP과 소스 ZIP을 함께 생성한다.
2. 소스 ZIP을 새 디렉터리에 푼다.
3. README의 명령만 실행한다.
4. AMO 업로드 ZIP과 재빌드 ZIP을 각각 별도 폴더에 푼다.
5. 경로 목록과 각 파일의 SHA-256을 비교한다.
6. 차이가 있으면 제출하지 않는다.

비교 시 ZIP 파일 자체의 해시만 확인해서는 안 된다. ZIP timestamp 때문에 압축 파일 해시는 달라질 수 있으므로 내부 파일을 먼저 비교한다. 목표는 다음 항목이 모두 일치하는 것이다.

- 파일 경로와 파일 개수
- `manifest.json`을 포함한 모든 텍스트/바이너리 파일 내용
- 에디터 번들 `vendor/wysiwyg-markdown.js`
- npm에서 복사한 축소 라이브러리
- 라이선스 파일

장기적으로는 `build.js`의 ZIP 항목 순서와 timestamp를 고정해 ZIP 자체의 SHA-256까지 같게 만드는 것을 권장한다.

## 7. `README-AMO.md`에 넣을 내용

실제 제출 소스 ZIP의 README는 심사자가 바로 읽을 수 있도록 영어로 작성하는 것을 권장한다. 최소한 다음 내용을 포함한다.

```markdown
# SideNote 4.2.10 - AMO Source Build Instructions

## Environment

- Ubuntu 24.04.4 LTS, ARM64
- Node.js 24.14.0
- npm 11.9.0
- Network access is used only by npm to download public dependencies from the
  official npm registry during `npm ci`.

## Build

From the directory containing this README:

1. `npm ci`
2. `npm ci --prefix SideNote`
3. `npm run clean --prefix SideNote`
4. `npm run build:amo`

The Firefox extension is produced at:

- Directory: `SideNote/build/firefox/`
- Package: `SideNote/build/firefox-4_2_10.zip`

The first-party file `SideNote/vendor/wysiwyg-markdown.js` is generated from
the TypeScript sources in `src/` by Vite/esbuild and is then copied into the
extension by `scripts/sync-sidenote.mjs`.

All third-party dependencies are public packages declared and locked in the
two included `package.json` and `package-lock.json` files.
```

README의 버전, 경로와 도구 버전은 자동 생성하거나 빌드 스크립트가 검증하게 해야 한다. 오래된 버전 문자열이 남아 있으면 심사 지연 원인이 된다.

## 8. AMO 제출 절차

공식 [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) 절차에 따라 다음과 같이 제출한다.

1. [AMO Developer Hub](https://addons.mozilla.org/developers/)에 로그인한다.
2. 새 애드온 또는 기존 SideNote의 새 버전 제출 화면을 연다.
3. `SideNote/build/firefox-4_2_10.zip`을 확장 파일로 업로드한다.
4. 자동 검증 결과의 오류를 수정하고 보안·개인정보 경고도 확인한다.
5. 호환 플랫폼을 선택하고 계속한다.
6. 소스 코드 제공 여부 질문에서 **Yes**를 선택한다.
7. `sidenote-4.2.10-source.zip`을 소스 코드 파일로 업로드한다.
8. **Notes for Reviewers**에 빌드 진입점, 결과 경로, 두 단계 번들 구조와 제3자 라이브러리 정보를 적는다.
9. 버전 정보를 검토하고 제출한다.

기존 버전에 소스를 나중에 추가하려면 `My Add-ons`에서 SideNote를 열고 **Manage Status & Versions → 해당 버전 → Source code → Browse → Save changes** 순서로 첨부할 수 있다.

확장 패키지는 ZIP 안의 최상위에 `manifest.json`이 있어야 하며, 바깥쪽 디렉터리 자체를 한 단계 더 감싸서 압축하면 안 된다. 현재 `SideNote/build.js`의 `directory(sourceDir, false)` 방식은 이 구조에 맞는다. 자세한 패키징 기준은 [Package your extension](https://extensionworkshop.com/documentation/publish/package-your-extension/)을 참고한다.

## 9. Notes for Reviewers 예시

```text
SideNote 4.2.10 includes one first-party generated bundle:
vendor/wysiwyg-markdown.js.

Its readable TypeScript source is included in the source archive under src/.
The complete build is performed locally with open-source npm tools by running
the four commands in README-AMO.md. The rebuilt Firefox extension is written to
SideNote/build/firefox/, and the uploadable ZIP is
SideNote/build/firefox-4_2_10.zip.

Third-party libraries are unmodified release versions installed from the
official npm registry. Their exact versions and integrity hashes are declared
in package.json/package-lock.json and SideNote/package.json/package-lock.json.
No private package, private registry, web-based build tool, or remote runtime
code is used.
```

필요하면 여기에 테스트 방법도 짧게 추가한다. 로그인이나 외부 서비스가 필요하지 않다면 그 사실도 명시한다.

## 10. 구현 우선순위

### P0: 제출 전에 반드시 처리

- [ ] 상위 프로젝트에 `build:amo` 단일 빌드 명령 추가
- [ ] `README-AMO.md` 작성
- [ ] allow-list 기반 `create-amo-source-package` 스크립트 작성
- [ ] 두 저장소의 소스와 lockfile을 한 소스 ZIP에 포함
- [ ] Node 24.14.0/npm 11.9.0으로 릴리스 환경 고정 또는 실제 사용 환경을 README에 정확히 명시
- [ ] 릴리스 CI가 WYSIWYG 에디터를 원본에서 다시 빌드한 뒤 SideNote를 패키징하도록 변경
- [ ] 깨끗한 환경에서 제출 ZIP과 재빌드 결과의 내부 파일 diff가 0인지 검증
- [ ] AMO Notes for Reviewers 작성

### P1: 재현성과 유지보수 개선

- [ ] `web-ext` 버전을 devDependency로 고정하고 CI에서 lint 실행
- [ ] `SideNote/build.js`가 항상 출력 폴더를 비우고 시작하도록 변경
- [ ] Firefox 전용 빌드 target 추가
- [ ] ZIP 파일 순서/timestamp를 정규화해 archive 자체도 결정적으로 생성
- [ ] `package.json`, `manifest.json`, README와 출력 이름의 버전 일치 자동 검사
- [ ] 확장 ZIP, 소스 ZIP, 두 커밋 SHA와 내부 파일 hash manifest를 한 릴리스에 보관

## 11. 두 저장소 관리에 대한 권장안

현재 상위 저장소는 `SideNote/`를 무시하고, SideNote는 자체 `.git`을 가진 별도 저장소다. 이 구조에서는 한 태그가 에디터 소스와 SideNote 소스의 정확한 조합을 고정하지 못한다.

단기적으로는 소스 패키지 생성기가 다음을 수행하게 한다.

- 두 저장소에 커밋되지 않은 변경이 없는지 확인
- 두 저장소의 commit SHA 기록
- 현재 두 작업 트리에서 allow-list 파일을 한 임시 폴더로 복사
- 그 폴더에서 실제 재현 빌드 시험
- 확장 ZIP과 소스 ZIP을 같은 실행에서 생성

장기적으로는 다음 중 하나를 선택하는 편이 좋다.

1. 에디터와 SideNote를 하나의 monorepo/npm workspace로 통합한다.
2. SideNote가 에디터 저장소의 정확한 commit을 submodule 등으로 고정한다.
3. 릴리스 CI가 두 저장소를 각각 명시적인 commit SHA로 checkout하고 소스 ZIP에도 두 소스를 모두 포함한다.

어느 방식을 택하든 AMO 심사자는 Git 저장소나 submodule을 추가로 받아야 해서는 안 된다. 제출한 소스 ZIP 하나만 풀고 공식 npm 레지스트리에서 의존성을 설치해 전체 확장을 빌드할 수 있어야 한다.

## 12. 최종 제출 체크리스트

- [ ] 확장 버전과 소스 ZIP 버전이 동일하다.
- [ ] `SideNote/package.json`과 `SideNote/manifest.json` 버전이 동일하다.
- [ ] 소스 ZIP에 두 `package-lock.json`이 있다.
- [ ] 소스 ZIP에 WYSIWYG TypeScript 원본이 있다.
- [ ] 소스 ZIP에 `SideNote/build.js`와 루트 빌드/동기화 스크립트가 있다.
- [ ] `README-AMO.md`의 네 명령만으로 빌드된다.
- [ ] 비공개 저장소, 전역 설치 도구, 웹 기반 빌드 서비스에 의존하지 않는다.
- [ ] npm 외의 임의 URL에서 빌드 의존성을 내려받지 않는다.
- [ ] 제출 ZIP과 재빌드 결과의 내부 파일 diff가 없다.
- [ ] `web-ext lint` 오류가 없다.
- [ ] 제3자 라이브러리가 수정되지 않은 릴리스 버전이다.
- [ ] Notes for Reviewers에 에디터 번들 생성 경로와 의존성 정보를 적었다.
- [ ] 소스 ZIP에 비밀키, 토큰, `.git`, `node_modules`, 빌드 산출물이 없다.
- [ ] 두 ZIP이 각각 200MB 미만이다.
- [ ] 제출한 확장 ZIP, 소스 ZIP, hash와 커밋 SHA를 보관했다.

## 공식 참고 자료

- [Mozilla: Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Mozilla: Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
- [Mozilla: Third Party Library Usage](https://extensionworkshop.com/documentation/publish/third-party-library-usage/)
- [Mozilla: Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Mozilla: Package your extension](https://extensionworkshop.com/documentation/publish/package-your-extension/)
- [Mozilla: Getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)

