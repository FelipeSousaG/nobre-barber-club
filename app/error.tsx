"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="status-page"><span>ERRO / OPERAÇÃO INTERROMPIDA</span><h1>Algo saiu do desenho.</h1><p>Nenhum dado sensível foi exibido. Você pode tentar novamente com segurança.</p><button type="button" onClick={reset}>Tentar novamente →</button><Link href="/">Voltar para a Nobre</Link></main>;
}
