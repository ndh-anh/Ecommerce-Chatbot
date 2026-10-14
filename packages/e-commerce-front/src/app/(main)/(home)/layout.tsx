import Newsletter from "@/features/main/home/components/Newsletter/Newsletter";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Commerce | Trang chủ",
  description: "Mua sắm trực tuyến dễ dàng và nhanh chóng.",
};

export default function HomeLayout({
  children,
  category,
  product,
}: {
  children: React.ReactNode;
  category: React.ReactNode;
  product: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-12 pb-12">
      {children}
      <div className="w-full flex flex-col gap-12">
        {category}
        {product}
        <Newsletter />
      </div>
    </div>
  );
}
