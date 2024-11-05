export type Leaf = {
	type: string;
};
export type Text = Leaf & {
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
export type Paragraph = Leaf[];
export type RichTextMessage = Paragraph[];
