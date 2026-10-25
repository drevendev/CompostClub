param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$Icon)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
public static class CompostIcon {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr BeginUpdateResource(string file, bool delete);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool EndUpdateResource(IntPtr handle, bool discard);
  public static void Apply(string file, string icon) {
    var bytes = File.ReadAllBytes(icon);
    using(var reader = new BinaryReader(new MemoryStream(bytes))) {
      if(reader.ReadUInt16()!=0 || reader.ReadUInt16()!=1) throw new Exception("Invalid ICO header");
      ushort count=reader.ReadUInt16();
      if(count<1 || count>16) throw new Exception("Invalid ICO count");
      var group=new MemoryStream(); var writer=new BinaryWriter(group);
      writer.Write((ushort)0); writer.Write((ushort)1); writer.Write(count);
      var images=new byte[count][];
      for(ushort i=0;i<count;i++) {
        writer.Write(reader.ReadBytes(8));
        uint size=reader.ReadUInt32(), offset=reader.ReadUInt32();
        if((ulong)offset+size>(ulong)bytes.Length) throw new Exception("Invalid ICO bounds");
        writer.Write(size); writer.Write((ushort)(i+1));
        images[i]=new byte[size]; Array.Copy(bytes,offset,images[i],0,size);
      }
      IntPtr handle=BeginUpdateResource(Path.GetFullPath(file),false);
      if(handle==IntPtr.Zero) throw new Win32Exception();
      bool committed=false;
      try {
        for(int i=0;i<count;i++) if(!UpdateResource(handle,(IntPtr)3,(IntPtr)(i+1),1033,images[i],(uint)images[i].Length)) throw new Win32Exception();
        var data=group.ToArray();
        if(!UpdateResource(handle,(IntPtr)14,(IntPtr)1,1033,data,(uint)data.Length)) throw new Win32Exception();
        if(!EndUpdateResource(handle,false)) throw new Win32Exception();
        committed=true;
      } finally { if(!committed) EndUpdateResource(handle,true); }
    }
  }
}
'@
[CompostIcon]::Apply($Executable, $Icon)
