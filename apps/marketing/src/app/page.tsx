import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { ProductPreview } from "@/components/product-preview";

export default function Home() {
  return (
    <main className="min-h-screen bg-(--background)">
      <Navbar />
      <Hero />
      <ProductPreview />
    </main>
  );
}