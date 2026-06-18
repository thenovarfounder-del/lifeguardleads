import './globals.css';

export const metadata = {
  title: 'LifeGuard Leads | Florida Impact Window Lead Machine',
  description: 'Florida impact window and door permit leads dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
