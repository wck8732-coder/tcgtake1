// CardImporterEditor.cs  (Assets/Editor — UnityEditor only)
// Renamed build path: the canonical Unity card data is now GENERATED from
// the live card_database.json (480 cards, v0.1042) via the Node build script,
// NOT from the legacy tcgtake1 CSV. Replaces the old CSV-based importer.
using System.Diagnostics;
using UnityEditor;
using UnityEngine;

public class CardImporterEditor : EditorWindow
{
    // Port target: v0.1042 root CardImporterEditor (CSV -> tcgtake1_cards.json).
    // New path: card_database.json (480) -> Assets/StreamingAssets/cards.json (CardDatabase wrapper).
    [MenuItem("TCG/Build Unity Card Data")]
    public static void BuildUnityCardData()
    {
        string root = GetProjectRoot();
        string nodeExe = "node";
        string args = $"\"{root}\\build-unity-cards.js\"";
        Run(nodeExe, args);
        AssetDatabase.Refresh();
        Debug.Log("Unity card data rebuilt from card_database.json.");
    }

    [MenuItem("TCG/Build All Card Data")]
    public static void BuildAllCardData()
    {
        BuildUnityCardData();
        Debug.Log("All card data built successfully.");
    }

    private static void Run(string exe, string args)
    {
        var psi = new ProcessStartInfo { FileName = exe, Arguments = args, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
        using (var p = Process.Start(psi))
        {
            string outLog = p.StandardOutput.ReadToEnd();
            string errLog = p.StandardError.ReadToEnd();
            p.WaitForExit();
            if (p.ExitCode != 0) Debug.LogError($"TCG build failed:\n{outLog}\n{errLog}");
            else Debug.Log($"TCG build:\n{outLog}");
        }
    }

    private static string GetProjectRoot()
    {
        // Unity project = this repo root is the parent of unity/
        string upm = Application.dataPath;            // <root>/unity/Assets
        string unityDir = System.IO.Path.GetFullPath(System.IO.Path.Combine(upm, "..", ".."));
        return System.IO.Path.GetFullPath(System.IO.Path.Combine(unityDir, "..")); // repo root
    }
}
