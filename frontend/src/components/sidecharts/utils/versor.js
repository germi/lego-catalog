// Quaternion-based spherical rotation math for rotate-mode maps.
// Adapted from https://github.com/d3/versor

function _vCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function _vDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export const versor = {
  quat([l, p, g]) {
    [l, p, g] = [l * Math.PI / 360, p * Math.PI / 360, g * Math.PI / 360];
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [cl*cp*cg + sl*sp*sg, sl*cp*cg - cl*sp*sg, cl*sp*cg + sl*cp*sg, cl*cp*sg - sl*sp*cg];
  },
  cartesian([lambda, phi]) {
    const l = lambda * Math.PI / 180, p = phi * Math.PI / 180, cp = Math.cos(p);
    return [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
  },
  delta(v0, v1) {
    const w = _vCross(v0, v1), l = Math.sqrt(_vDot(w, w));
    if (!l) return [1, 0, 0, 0];
    const t = Math.atan2(l, _vDot(v0, v1)) / 2, s = Math.sin(t) / l;
    return [Math.cos(t), w[0] * s, w[1] * s, w[2] * s];
  },
  multiply([a0, b0, c0, d0], [a1, b1, c1, d1]) {
    return [a0*a1-b0*b1-c0*c1-d0*d1, a0*b1+b0*a1+c0*d1-d0*c1,
            a0*c1-b0*d1+c0*a1+d0*b1, a0*d1+b0*c1-c0*b1+d0*a1];
  },
  rotation([a, b, c, d]) {
    return [
      Math.atan2(2*(a*b + c*d), 1 - 2*(b*b + c*c)) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2*(a*c - d*b)))) * 180 / Math.PI,
      Math.atan2(2*(a*d + b*c), 1 - 2*(c*c + d*d)) * 180 / Math.PI,
    ];
  },
  _slerp(q0, q1, t) {
    let d = q0[0]*q1[0] + q0[1]*q1[1] + q0[2]*q1[2] + q0[3]*q1[3];
    const q = d < 0 ? [-q1[0], -q1[1], -q1[2], -q1[3]] : [q1[0], q1[1], q1[2], q1[3]];
    if (Math.abs(d) >= 1) return t ? q : [q0[0], q0[1], q0[2], q0[3]];
    d = Math.abs(d);
    const a = Math.acos(d), s = Math.sin(a);
    const s0 = Math.sin((1-t)*a)/s, s1 = Math.sin(t*a)/s;
    return [s0*q0[0]+s1*q[0], s0*q0[1]+s1*q[1], s0*q0[2]+s1*q[2], s0*q0[3]+s1*q[3]];
  },
  interpolate(r0, r1) {
    const q0 = this.quat(r0), q1 = this.quat(r1);
    return (t) => this.rotation(this._slerp(q0, q1, t));
  },
};
