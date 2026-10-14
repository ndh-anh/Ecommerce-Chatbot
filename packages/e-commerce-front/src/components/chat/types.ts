export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  data?: any;
  type?: string;
}
