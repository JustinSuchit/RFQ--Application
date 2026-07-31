declare module "mailparser" {
  export type ParsedAddress = {
    name?: string;
    address?: string;
  };

  export type ParsedAddressList = {
    value?: ParsedAddress[];
    text?: string;
  };

  export type ParsedAttachment = {
    filename?: string;
    contentType?: string;
    size?: number;
  };

  export type ParsedMail = {
    from?: ParsedAddressList;
    subject?: string;
    text?: string;
    html?: string | false;
    date?: Date;
    attachments?: ParsedAttachment[];
  };

  export function simpleParser(source: Buffer | string): Promise<ParsedMail>;
}
