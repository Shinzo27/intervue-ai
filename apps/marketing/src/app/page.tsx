import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { ProductPreview } from "@/components/product-preview";
import { HowItWorks } from "@/components/how-it-works";
import { Differentiator } from "@/components/differentiator";
import { Pricing } from "@/components/pricing";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-(--background)">
      <Navbar />
      <Hero />
      <ProductPreview />
      <HowItWorks />
      <Differentiator />
      <Pricing />
      <Footer />
    </main>
  );
}