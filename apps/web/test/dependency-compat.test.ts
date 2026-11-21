import { createRequire } from "node:module";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const formatterRequire = createRequire(require.resolve("js-beautify"));

it("security overrides preserve formatter globs, EditorConfig and Vue HTML output", () => {
  const root = process.cwd();
  const { globSync } = formatterRequire("glob");
  const { parseFromFilesSync } = formatterRequire("editorconfig");
  expect(globSync("apps/web/src/pages/*.vue", { cwd: root })).toContain(
    join("apps", "web", "src", "pages", "Assets.vue"),
  );
  expect(
    parseFromFilesSync(join(root, "Card.vue"), [
      {
        name: join(root, ".editorconfig"),
        contents: Buffer.from("root=true\n[*.{html,vue}]\nindent_size=2\n"),
      },
    ]),
  ).toMatchObject({ indent_size: 2 });
  const wrapper = mount({ template: "<div><p>AssetFlow</p></div>" });
  try {
    expect(wrapper.html()).toBe("<div>\n  <p>AssetFlow</p>\n</div>");
  } finally {
    wrapper.unmount();
  }
});
