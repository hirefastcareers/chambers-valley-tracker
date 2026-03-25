import { v2 as cloudinary } from "cloudinary";
import { requiredEnv } from "./env";

let configured = false;

export function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
      api_key: requiredEnv("CLOUDINARY_API_KEY"),
      api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
    });
    configured = true;
  }
  return cloudinary;
}

