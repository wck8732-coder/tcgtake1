// CardImporterEditor.cs
// Unity Editor window for building card data from JSON
// Replaces the old CSV importer - now reads from card_database.json
using System.Diagnostics;
using System.IO;
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

    [MenuItem("TCG/Validate Card Data")]
    public static void ValidateCardData()
    {
        string root = GetProjectRoot();
        string nodeExe = "node";
        string args = $"\"{root}\\validate-data.js\"";
        Run(nodeExe, args);
    }

    [MenuItem("TCG/Run Game Tests")]
    public static void RunGameTests()
    {
        string root = GetProjectRoot();
        string nodeExe = "node";
        string args = $"\"{root}\\recall_ominous_test.js\"";
        Run(nodeExe, args);
    }

    private static void Run(string exe, string args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = exe,
            Arguments = args,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = GetProjectRoot()
        };

        using (var p = Process.Start(psi))
        {
            string outLog = p.StandardOutput.ReadToEnd();
            string errLog = p.StandardError.ReadToEnd();
            p.WaitForExit();

            if (p.ExitCode != 0)
                Debug.LogError($"TCG build failed:\n{outLog}\n{errLog}");
            else
                Debug.Log($"TCG build:\n{outLog}");
        }
    }

    private static string GetProjectRoot()
    {
        // Unity project = this repo root is the parent of unity/
        // Assets path: <repo>/Assets
        string assetsPath = Application.dataPath; // <repo>/Assets
        string repoRoot = Path.GetFullPath(Path.Combine(assetsPath, ".."));
        return repoRoot;
    }
}