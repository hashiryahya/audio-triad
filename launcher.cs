using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace AudioTriadLauncher
{
    static class Program
    {
        private static Process serverProcess = null;

        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(appDir, "server.js");
            int port = 3000;

            if (!File.Exists(serverScript))
            {
                MessageBox.Show("Error: server.js not found in " + appDir, "AudioTriad Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Check if server is already active
            bool isRunning = IsPortActive(port);
            if (!isRunning)
            {
                try
                {
                    // Locate node.exe robustly
                    string nodeExe = "node.exe";
                    string[] possibleNodePaths = new string[]
                    {
                        Path.Combine(appDir, "node.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs\\node.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs\\node.exe"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs\\node\\node.exe")
                    };

                    foreach (string np in possibleNodePaths)
                    {
                        if (File.Exists(np))
                        {
                            nodeExe = np;
                            break;
                        }
                    }

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = nodeExe;
                    psi.Arguments = "\"" + serverScript + "\" --no-browser";
                    psi.WorkingDirectory = appDir;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;

                    serverProcess = Process.Start(psi);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to start AudioTriad engine:\n" + ex.Message + "\n\nPlease ensure Node.js is installed.", "AudioTriad Notice", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }

                // Wait up to 3 seconds for server initialization
                for (int i = 0; i < 15; i++)
                {
                    if (IsPortActive(port)) break;
                    Thread.Sleep(200);
                }
            }

            string targetUrl = "http://localhost:" + port;
            LaunchDesktopWindow(targetUrl);
        }

        private static bool IsPortActive(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult ar = client.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = ar.AsyncWaitHandle.WaitOne(200);
                    if (ok && client.Connected)
                    {
                        client.EndConnect(ar);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void LaunchDesktopWindow(string url)
        {
            // Try Edge or Chrome in --app mode (opens as native app window without URL bar)
            string[] browsers = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\Chrome\\Application\\chrome.exe")
            };

            foreach (string b in browsers)
            {
                if (File.Exists(b))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = b;
                        psi.Arguments = "--app=" + url;
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                        return;
                    }
                    catch { }
                }
            }

            // Fallback to default browser
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { }
        }
    }
}
