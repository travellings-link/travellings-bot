export type BaseLeaf = {
	type: string;
};
export type Text = BaseLeaf & {
	type: "text";
	content: string;
	bold?: boolean;
	underline?: boolean;
	italic?: boolean;
};
export type Link = Omit<Text, "type"> & {
	type: "link";
	href: string;
	bold: false;
	underline: true;
	italic: false;
};
export type Leaf = BaseLeaf | Text | Link;
export type Paragraph = Leaf[];
export type RichTextMessage = Paragraph[];
