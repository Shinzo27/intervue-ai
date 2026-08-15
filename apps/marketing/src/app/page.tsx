import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { ProductPreview } from "@/components/product-preview";
import { HowItWorks } from "@/components/how-it-works";
import { Differentiator } from "@/components/differentiator";
import { Pricing } from "@/components/pricing";
import { Footer } from "@/components/footer";
import { Demo } from "@/components/demo";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-(--background)">
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <Differentiator />
        <Pricing />
        <Demo />
      </main>
      <Footer />
    </>
  );
}
