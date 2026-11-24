import { redirect } from "next/navigation";

export default function BlogDirectoryRedirectPage() {
  redirect("/browse?type=blog");
}
