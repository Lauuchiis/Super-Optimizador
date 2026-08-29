using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using LibreHardwareMonitor.Hardware;

internal sealed class SensorReading
{
    public HardwareType HardwareType;
    public SensorType SensorType;
    public string HardwareName;
    public string Name;
    public float Value;
}

internal static class HardwareSensors
{
    private static readonly HardwareType[] GpuTypes =
    {
        HardwareType.GpuAmd,
        HardwareType.GpuNvidia,
        HardwareType.GpuIntel
    };

    private static bool IsGpu(HardwareType type)
    {
        return GpuTypes.Contains(type);
    }

    private static bool IsCpuLike(SensorReading reading)
    {
        if (reading.HardwareType == HardwareType.Cpu) return true;
        if (reading.HardwareType != HardwareType.Motherboard && reading.HardwareType != HardwareType.SuperIO && reading.HardwareType != HardwareType.EmbeddedController) return false;
        string name = reading.Name.ToLowerInvariant();
        return name.Contains("cpu") || name.Contains("package") || name.Contains("tctl") || name.Contains("tdie") || name.Contains("core");
    }

    private static void Collect(IHardware hardware, List<SensorReading> readings)
    {
        try { hardware.Update(); } catch { }
        foreach (ISensor sensor in hardware.Sensors ?? new ISensor[0])
        {
            if (!sensor.Value.HasValue || float.IsNaN(sensor.Value.Value) || float.IsInfinity(sensor.Value.Value)) continue;
            readings.Add(new SensorReading
            {
                HardwareType = hardware.HardwareType,
                SensorType = sensor.SensorType,
                HardwareName = hardware.Name ?? string.Empty,
                Name = sensor.Name ?? string.Empty,
                Value = sensor.Value.Value
            });
        }
        foreach (IHardware child in hardware.SubHardware ?? new IHardware[0]) Collect(child, readings);
    }

    private static float? PickTemperature(IEnumerable<SensorReading> readings, bool gpu)
    {
        var candidates = readings
            .Where(item => item.SensorType == SensorType.Temperature && (gpu ? IsGpu(item.HardwareType) : IsCpuLike(item)))
            .Where(item => item.Value > 0 && item.Value < 150)
            .ToList();
        if (!candidates.Any()) return null;
        string[] preferred = gpu
            ? new[] { "gpu core", "core", "junction", "hot spot", "hotspot", "package" }
            : new[] { "package", "tctl/tdie", "tdie", "core average", "cpu package", "cpu" };
        var selected = candidates
            .OrderBy(item => {
                string name = item.Name.ToLowerInvariant();
                int index = Array.FindIndex(preferred, value => name.Contains(value));
                return index < 0 ? preferred.Length : index;
            })
            .ThenBy(item => item.Name.Length)
            .First();
        return selected.Value;
    }

    private static float? PickGpuUsage(IEnumerable<SensorReading> readings)
    {
        var candidates = readings
            .Where(item => item.SensorType == SensorType.Load && IsGpu(item.HardwareType))
            .Where(item => item.Value >= 0 && item.Value <= 100)
            .ToList();
        if (!candidates.Any()) return null;
        string[] preferred = { "gpu core", "3d", "d3d", "graphics", "gpu" };
        var selected = candidates
            .OrderBy(item => {
                string name = item.Name.ToLowerInvariant();
                int index = Array.FindIndex(preferred, value => name.Contains(value));
                return index < 0 ? preferred.Length : index;
            })
            .ThenByDescending(item => item.Value)
            .First();
        return selected.Value;
    }

    private static string JsonNumber(float? value)
    {
        return value.HasValue ? value.Value.ToString(CultureInfo.InvariantCulture) : "null";
    }

    public static int Main()
    {
        var readings = new List<SensorReading>();
        Computer computer = null;
        try
        {
            computer = new Computer
            {
                IsCpuEnabled = true,
                IsGpuEnabled = true,
                IsMotherboardEnabled = true,
                IsMemoryEnabled = true,
                IsControllerEnabled = true
            };
            computer.Open();
            foreach (IHardware hardware in computer.Hardware) Collect(hardware, readings);
            Console.WriteLine("{\"cpuTemp\":" + JsonNumber(PickTemperature(readings, false)) + ",\"gpuTemp\":" + JsonNumber(PickTemperature(readings, true)) + ",\"gpuUsage\":" + JsonNumber(PickGpuUsage(readings)) + ",\"source\":\"LibreHardwareMonitor\"}");
            return 0;
        }
        catch
        {
            Console.WriteLine("{\"cpuTemp\":null,\"gpuTemp\":null,\"gpuUsage\":null,\"source\":\"LibreHardwareMonitor\"}");
            return 0;
        }
        finally
        {
            try { if (computer != null) computer.Close(); } catch { }
        }
    }
}
