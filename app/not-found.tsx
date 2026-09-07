import Link from "next/link";

export default function NotFound() {
  return <main className="status-page"><span>404 / FORA DO ARQUIVO</span><h1>Esta página não está na cadeira.</h1><p>O endereço pode ter mudado ou nunca ter existido.</p><Link href="/">Voltar para a Nobre →</Link></main>;
}
