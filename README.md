# WYSIWYG Markdown

확장 가능한 WYSIWYG Markdown 에디터 Web Component입니다.

현재는 초기 MVP 구현 단계입니다. 전체 설계와 SideNote 통합 계획은
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)를 참고하세요.

## 개발

```powershell
npm.cmd install
npm.cmd run demo
```

## 테스트와 빌드

```powershell
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

프로덕션 빌드는 번들에 포함되는 런타임 패키지의 라이선스를
`THIRD_PARTY_LICENSES.md`에 함께 생성합니다.

빌드된 단일 ESM 번들을 데모에서 확인하려면 다음 명령을 실행한 뒤
출력된 주소의 `/demo/dist.html`을 엽니다.

```powershell
npm.cmd run demo:dist
```

SideNote 저장소에 최신 번들과 라이선스 고지를 복사하려면 다음 명령을 사용합니다.

```powershell
npm.cmd run sync:sidenote
```

## 기본 사용법

```html
<script type="module" src="./wysiwyg-markdown.js"></script>
<wysiwyg-markdown id="editor"></wysiwyg-markdown>
```

```js
const editor = document.querySelector('#editor');
editor.value = '# Hello';
editor.addEventListener('input', (event) => {
  console.log(event.detail.markdown);
});
```

기본적으로 WYSIWYG 문서를 더블클릭하면 문서 전체를 수정하는 Markdown source
모드로 전환됩니다. `Ctrl/Cmd + Enter`를 누르면 이전 WYSIWYG 또는 readonly 모드로
돌아갑니다. 블록 단위 source 편집이 필요한 경우에만 다음 옵션을 사용합니다.

```html
<wysiwyg-markdown source-edit-scope="block"></wysiwyg-markdown>
```

호스트 앱의 디자인을 Shadow DOM 내부에 적용하려면 신뢰할 수 있는 CSS 문자열을
`themeCss` 프로퍼티로 전달할 수 있습니다.

```js
editor.themeCss = `
  .editor-mount .ProseMirror { padding: 12px; }
  .editor-mount .ProseMirror pre { white-space: pre-wrap; }
`;
```

펜스 코드 블록은 언어 표시와 복사 버튼을 기본 제공하며 필요하면 숨길 수 있습니다.

```js
editor.showCodeBlockHeader = false;
```
