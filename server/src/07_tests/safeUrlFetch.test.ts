import { fetchPublicHtml, isPublicIp } from "../utils/safeUrlFetch";

describe("safeUrlFetch", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
  ])("rejects non-public IPv4 address %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(["::1", "fc00::1", "fe80::1", "2001:db8::1"])(
    "rejects non-public IPv6 address %s",
    (address) => {
      expect(isPublicIp(address)).toBe(false);
    },
  );

  it("allows a public DNS address", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });

  it.each([
    "file:///etc/passwd",
    "http://127.0.0.1/",
    "http://192.168.1.1/",
    "http://user:pass@example.com/",
    "http://example.com:8080/",
    "http://localhost/",
  ])("rejects unsafe URL %s before making a request", async (url) => {
    await expect(fetchPublicHtml(url)).rejects.toThrow();
  });
});
