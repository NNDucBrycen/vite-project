import { WysiwygMarkdownEditor } from './wysiwyg-md'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div id="editor-container"></div>
  <h3>Live Markdown Output</h3>
  <pre id="markdown-output"></pre>
`

const output = document.querySelector<HTMLPreElement>('#markdown-output')!

const editor = new WysiwygMarkdownEditor(document.getElementById('editor-container')!, {
  value:
    '# Hello\n\nType **bold**, *italic*, `# ` for headings, `- ` for lists, `> ` for quotes.\n',
  onChange: (markdown) => {
    output.textContent = markdown
  },
  uploadImage: async (file) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return URL.createObjectURL(file)
  },
  onUploadError: (err) => {
    alert('Upload failed: ' + err)
  },
  uploadVideo: async (file) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return URL.createObjectURL(file)
  },
  onVideoUploadError: (err) => {
    alert('Upload failed: ' + err)
  },
})

output.textContent = editor.getMarkdown()
