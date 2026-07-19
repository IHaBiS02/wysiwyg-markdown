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
