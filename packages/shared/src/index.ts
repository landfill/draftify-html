export type {
  SpecProject,
  MockupSource,
  UploadMockupSource,
  ProxyMockupSource,
  SnippetMockupSource,
  MaskingRule,
  Scene,
  Annotation,
  Anchor,
  Rect,
  MarkerOffset,
  Transition,
  ExportRecord,
  ProjectListItem,
  TargetDevice,
} from "./types.js";

export { MOBILE_RENDER_WIDTH } from "./types.js";

export {
  WORKING_NAME,
  DISPLAY_NAME,
  EDITION_NAME,
  RESERVED_PATH_PREFIX,
  PENDING_QUEUE_KEY_PREFIX,
  PROJECT_DATA_ATTR,
  TRANSPORT_DATA_ATTR,
  BRIDGE_REQUEST_TYPE,
  BRIDGE_RESPONSE_TYPE,
} from "./constants.js";

export { encodeConnection, decodeConnection, type ConnectionInfo } from "./connection.js";

export {
  THEME_TOKENS,
  themeTokenDeclarations,
  type ThemeMode,
  type ThemeTokenName,
} from "./theme.js";

export {
  sceneDisplayTitle,
  scenePageBandActive,
  sceneStageHeaderTitle,
  sceneNavLabel,
  previousSceneSectionLabel,
  previousSceneTargetDevice,
  sceneRenderWidth,
} from "./sceneDisplay.js";
