declare module 'react-split';

declare module 'remove-markdown';

declare module 'outline-icons';

declare module '@notea/headway-widget';

declare module 'markdown-link-extractor';

// 添加全局Window接口扩展
interface Window {
  __EDIT_MODE_TOGGLE__?: boolean;
}
