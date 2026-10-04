using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("音频合并")]
[assembly: AssemblyDescription("离线无损 WAV 音频合并，保留原采样率与位深")]
[assembly: AssemblyCompany("Music Tools")]
[assembly: AssemblyProduct("Music Tools Audio Joiner")]
[assembly: AssemblyVersion("1.0.0.0")]

internal static class Launcher
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string[] files = { "index.html", "style.css", "wav-engine.js", "app.js" };
            Assembly assembly = Assembly.GetExecutingAssembly();
            byte[][] contents = new byte[files.Length][];
            using (MemoryStream all = new MemoryStream())
            {
                for (int i = 0; i < files.Length; i++)
                {
                    using (Stream source = assembly.GetManifestResourceStream(files[i]))
                    using (MemoryStream copy = new MemoryStream())
                    {
                        if (source == null) throw new IOException("缺少应用资源：" + files[i]);
                        source.CopyTo(copy);
                        contents[i] = copy.ToArray();
                        all.Write(contents[i], 0, contents[i].Length);
                    }
                }
                string version;
                using (SHA256 sha = SHA256.Create())
                    version = BitConverter.ToString(sha.ComputeHash(all.ToArray())).Replace("-", "").Substring(0, 16);
                string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MusicTools", "AudioJoiner", version);
                Directory.CreateDirectory(directory);
                for (int i = 0; i < files.Length; i++)
                    File.WriteAllBytes(Path.Combine(directory, files[i]), contents[i]);
                string url = new Uri(Path.Combine(directory, "index.html")).AbsoluteUri + "?desktop=1";
                string[] browsers = {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
                };
                foreach (string browser in browsers)
                {
                    if (!File.Exists(browser)) continue;
                    Process.Start(new ProcessStartInfo {
                        FileName = browser,
                        Arguments = "--app=\"" + url + "\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Normal
                    });
                    return;
                }
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
        }
        catch (Exception error)
        {
            MessageBox.Show("无法打开音频合并工具。\n\n" + error.Message + "\n\n也可以解压网页版并双击 index.html 使用。", "音频合并", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
