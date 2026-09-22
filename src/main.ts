import { WysiwygMarkdownEditor } from './wysiwyg-md'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div id="editor-container"></div>
`

new WysiwygMarkdownEditor(document.getElementById('editor-container')!, {
  value:
    '# Hello\n\nType **bold**, *italic*, # for headings, - for lists, > for quotes.\n\n- Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n- Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n1. Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n2. Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n3. Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean et convallis purus. Proin quis nibh est. Sed accumsan bibendum maximus. 😅\n\n!video[](/demo/video.mp4)\n\n```mermaid\nflowchart LR\n  Start --> Review --> Done\n  style Start fill:#edf4ff,stroke:#397cff,stroke-width:1.5px\n  style Review fill:#f3edff,stroke:#9963ff,stroke-width:1.5px\n  style Done fill:#edf9f5,stroke:#25bc9a,stroke-width:1.5px\n```\n\n| Title 1 | Title 2 | Title 3 |\n| --- | --- | --- |\n| value 1 | value 2 | value 3 |\n| value 4 | value 5 | value 6 |\n\n<!-- wysiwyg-md:borderless-table -->\n| Title 1 | Title 2 | Title 3 |\n| --- | --- | --- |\n| value 1 | value 2 | value 3 |\n| value 4 | value 5 | value 6 |\n\n![Portrait](/demo/portrait.jpg){size=medium align=left}\n',
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
  uploadFile: async (file) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return URL.createObjectURL(file)
  },
  onFileUploadError: (err) => {
    alert('Upload failed: ' + err)
  },
})
