interface ImageKitAuth {
  token: string;
  expire: number;
  signature: string;
}

interface ImageKitUploadResponse {
  url: string;
  fileId: string;
  name: string;
  size: number;
}

const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";

async function getAuthParams(): Promise<ImageKitAuth> {
  const res = await fetch("/api/upload-auth");
  const detail = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(detail?.error || "Could not authorise the upload.");
  }
  return detail as ImageKitAuth;
}

/**
 * Browser-side signed upload. The signature comes from /api/upload-auth so the
 * ImageKit private key never reaches the bundle.
 */
export async function uploadToImageKit(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  if (!publicKey) throw new Error("ImageKit is not configured on this deployment.");

  const auth = await getAuthParams();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("publicKey", publicKey);
  formData.append("folder", folder);
  formData.append("token", auth.token);
  formData.append("expire", auth.expire.toString());
  formData.append("signature", auth.signature);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress((event.loaded / event.total) * 100);
      }
    };
    xhr.onload = () => {
      let data: Partial<ImageKitUploadResponse> & { message?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error body from the provider */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data?.message || data?.error || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.send(formData);
  });
}
