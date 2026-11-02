import { authenticate } from "./auth";
export function testAuthentication() {
  return authenticate("fixture");
}
